from functools import wraps
from flask import Blueprint, request, jsonify, current_app

from app import db
from app.models.user import User

user_bp = Blueprint('user', __name__)


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