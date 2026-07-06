from functools import wraps
import re

from flask import Blueprint, request, jsonify, current_app

from app import db
from app.models.user import User
from app.models.email_otp import EmailOtp
from app.services.email_service import send_login_code_email

user_bp = Blueprint('user', __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def require_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        user = User.verify_access_token(token)
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        request.current_user = user
        return func(*args, **kwargs)
    return wrapper


def _ensure_default_admin():
    default_admin_username = current_app.config.get("DEFAULT_ADMIN_USERNAME", "admin")
    default_admin_password = current_app.config.get("DEFAULT_ADMIN_PASSWORD", "admin")
    admin_user = db.session.query(User).filter(User.username == default_admin_username).first()
    if admin_user:
        if not admin_user.is_admin:
            admin_user.is_admin = True
            db.session.commit()
        return admin_user

    admin_user = User(
        username=default_admin_username,
        is_admin=True,
        has_password=True,
    )
    admin_user.set_password(default_admin_password)
    db.session.add(admin_user)
    db.session.commit()
    return admin_user


@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    uname = (data.get('uname') or '').strip()
    pwd = (data.get('pwd') or '').strip()

    if len(uname) < 3 or len(pwd) < 6:
        return jsonify({"success": False, "error": "Username >=3 and password >=6"}), 400

    existing = db.session.query(User).filter(User.username == uname).first()
    if existing:
        return jsonify({"success": False, "error": "Username already exists"}), 409

    user = User(username=uname, is_admin=False)
    user.is_ad_manager = False
    user.has_password = True
    user.set_password(pwd)
    db.session.add(user)
    db.session.commit()

    token = user.issue_access_token()
    return jsonify({
        "success": True,
        "user": user.to_dict(),
        "token": token
    }), 201


@user_bp.route('/login', methods=['GET', 'POST'])
def login():
    _ensure_default_admin()

    if request.method == 'GET':
        uname = (request.args.get('uname') or '').strip()
        pwd = (request.args.get('pwd') or '').strip()
    else:
        data = request.get_json() or {}
        uname = (data.get('uname') or '').strip()
        pwd = (data.get('pwd') or '').strip()

    user = db.session.query(User).filter(User.username == uname).first()
    if not user or not user.check_password(pwd):
        return jsonify({"success": False, "error": "Invalid username or password"}), 401

    token = user.issue_access_token()
    return jsonify({
        "success": True,
        "token": token,
        "user": user.to_dict(),
    })


@user_bp.route('/me', methods=['GET'])
@require_auth
def me():
    user = request.current_user
    return jsonify({"success": True, "user": user.to_dict()})


@user_bp.route('/auth/email/send-code', methods=['POST'])
def send_email_code():
    data = request.get_json() or {}
    email = User.normalize_email(data.get("email") or "")
    if not email or not _EMAIL_RE.match(email):
        return jsonify({"success": False, "error": "请输入有效邮箱"}), 400

    max_per_hour = int(current_app.config.get("OTP_MAX_REQUESTS_PER_HOUR", 5))
    if EmailOtp.recent_request_count(email) >= max_per_hour:
        return jsonify({"success": False, "error": "发送太频繁，请稍后再试"}), 429

    ttl = int(current_app.config.get("OTP_EXPIRY_SECONDS", 600))
    code = EmailOtp.issue(email, ttl_seconds=ttl)

    try:
        send_login_code_email(email, code)
    except Exception as exc:
        current_app.logger.exception("send_login_code_email failed")
        return jsonify({"success": False, "error": "验证码发送失败，请稍后重试"}), 500

    return jsonify({
        "success": True,
        "message": "验证码已发送，请查收邮箱（含垃圾箱）",
        "expires_in": ttl,
    })


@user_bp.route('/auth/email/verify', methods=['POST'])
def verify_email_code():
    data = request.get_json() or {}
    email = User.normalize_email(data.get("email") or "")
    code = (data.get("code") or "").strip()

    if not email or not _EMAIL_RE.match(email):
        return jsonify({"success": False, "error": "请输入有效邮箱"}), 400
    if not re.fullmatch(r"\d{6}", code):
        return jsonify({"success": False, "error": "请输入 6 位数字验证码"}), 400

    otp = (
        db.session.query(EmailOtp)
        .filter(EmailOtp.email == email)
        .order_by(EmailOtp.created_at.desc())
        .first()
    )
    if not otp or not otp.verify(code):
        return jsonify({"success": False, "error": "验证码错误或已过期"}), 401

    user, created = User.get_or_create_by_email(email)
    token = user.issue_access_token()
    needs_password = bool(email and not user.has_password and not user.is_admin)
    return jsonify({
        "success": True,
        "token": token,
        "user": user.to_dict(),
        "needs_password": needs_password,
        "created": created,
    })


@user_bp.route('/auth/email/login', methods=['POST'])
def email_password_login():
    data = request.get_json() or {}
    email = User.normalize_email(data.get("email") or "")
    pwd = (data.get("password") or "").strip()

    if not email or not _EMAIL_RE.match(email):
        return jsonify({"success": False, "error": "请输入有效邮箱"}), 400
    if len(pwd) < 6:
        return jsonify({"success": False, "error": "密码至少 6 位"}), 400

    user = User.find_by_email(email)
    if not user or not user.has_password or not user.check_password(pwd):
        return jsonify({"success": False, "error": "邮箱或密码错误，或尚未设置密码"}), 401

    token = user.issue_access_token()
    return jsonify({
        "success": True,
        "token": token,
        "user": user.to_dict(),
    })


@user_bp.route('/auth/set-password', methods=['POST'])
@require_auth
def set_password():
    data = request.get_json() or {}
    pwd = (data.get("password") or "").strip()
    confirm = (data.get("confirm_password") or data.get("confirm") or "").strip()

    if len(pwd) < 6:
        return jsonify({"success": False, "error": "密码至少 6 位"}), 400
    if pwd != confirm:
        return jsonify({"success": False, "error": "两次输入的密码不一致"}), 400

    user = request.current_user
    user.set_password(pwd)
    user.has_password = True
    db.session.commit()

    return jsonify({
        "success": True,
        "user": user.to_dict(),
    })