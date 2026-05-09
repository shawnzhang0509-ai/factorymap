from flask import Blueprint, request, jsonify, current_app
from app import db
from app.services.shop_service import ShopService
from app.models.shop_owner import ShopOwner
from app.models.shop import Shop
from app.models.user import User
from app.utils.auth import get_auth_user

shop_bp = Blueprint('shop', __name__)
service = ShopService()


def _require_auth_user():
    return get_auth_user(request)


def _is_admin_user(user):
    return bool(user and user.is_admin)


def _can_manage_all_shops(user):
    return bool(user and (user.is_admin or user.is_ad_manager))


def _can_edit_shop(user, shop_id):
    if not user:
        return False
    if _can_manage_all_shops(user):
        return True
    owner = ShopOwner.query.filter_by(shop_id=shop_id, user_id=user.id).first()
    return owner is not None


def _editable_shop_ids(user):
    if not user:
        return set()
    if _can_manage_all_shops(user):
        return None  # None means all shops editable.
    owner_links = ShopOwner.query.filter_by(user_id=user.id).all()
    return {item.shop_id for item in owner_links}


def _sanitize_shop_payload_for_role(data, user):
    """
    Enforce admin-only editable fields.
    Non-admin users cannot set or update badge-related fields.
    """
    cleaned = dict(data or {})
    if not _can_manage_all_shops(user):
        cleaned.pop("badge_text", None)
        cleaned.pop("new_girls_last_15_days", None)
        cleaned.pop("filter_city", None)
    return cleaned

@shop_bp.route('/search', methods=['GET'])
@shop_bp.route('/shop/search', methods=['GET'])
def search():
    auth_user = _require_auth_user()
    keyword = request.args.get('keyword', '').strip()
    results = service.search_shop(keyword)
    editable_ids = _editable_shop_ids(auth_user)

    payload = []
    for shop in results:
        item = shop.to_dict()
        item["can_edit"] = (editable_ids is None) or (shop.id in editable_ids)
        payload.append(item)
    return jsonify(payload)

@shop_bp.route('/add', methods=['POST'])
@shop_bp.route('/shop/add', methods=['POST'])
def add_shop():
    auth_user = _require_auth_user()
    if not auth_user:
        return jsonify({"error": "Unauthorized"}), 401
    if not _can_manage_all_shops(auth_user):
        return jsonify({"error": "Only admin or ad manager can create new ads"}), 403

    data = _sanitize_shop_payload_for_role(request.form.to_dict(), auth_user)
    files = request.files.getlist("pictures")
    try:
        shop = service.add_shop(data=data, files=files)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409

    existing = ShopOwner.query.filter_by(shop_id=shop.id, user_id=auth_user.id).first()
    if not existing:
        db.session.add(ShopOwner(shop_id=shop.id, user_id=auth_user.id))
        db.session.commit()

    # ✅ 修改：直接调用 to_dict()
    return jsonify(shop.to_dict())

# ✅ 临时加一个测试路由
@shop_bp.route('/list')
@shop_bp.route('/shop/list')
def list_all():
    return jsonify({"shops": "This is a test endpoint"})

@shop_bp.route('/del', methods=['POST'])
@shop_bp.route('/shop/del', methods=['POST'])
def delete_shop():
    auth_user = _require_auth_user()
    if not auth_user or not _is_admin_user(auth_user):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    shop_id = data.get('id')
    token = data.get('token')
    ADMIN_DELETE_TOKEN = current_app.config['ADMIN_DELETE_TOKEN']

    if token != ADMIN_DELETE_TOKEN:
        return jsonify({"error": "Unauthorized"}), 401

    if not shop_id:
        return jsonify({"error": "Missing shop id"}), 400

    isDeleteSuccess = service.del_shop(shop_id)
    if isDeleteSuccess:
        return jsonify({"success": True, "id": shop_id})
    else:
        return jsonify({"success": False, "id": shop_id})

# ✅ 原有路由：支持通过 ID 更新
@shop_bp.route('/update/<int:shop_id>', methods=['POST'])
@shop_bp.route('/shop/update/<int:shop_id>', methods=['POST'])
def update_shop(shop_id):
    try:
        auth_user = _require_auth_user()
        if not _can_edit_shop(auth_user, shop_id):
            return jsonify({"error": "Unauthorized"}), 401

        data = _sanitize_shop_payload_for_role(request.form.to_dict(), auth_user)
        files = request.files.getlist("pictures")
        shop = service.update_shop(shop_id=shop_id, data=data, files=files)

        # ✅ 修改：直接调用 to_dict()
        return jsonify(shop.to_dict())
    except ValueError as ve:
        msg = str(ve)
        if "already exists" in msg.lower():
            return jsonify({"error": msg}), 409
        current_app.logger.error(f"Update shop failed: {msg}")
        return jsonify({"error": msg}), 400
    except Exception as e:
        current_app.logger.error(f"Update shop failed: {str(e)}")
        return jsonify({"error": "更新失败", "details": str(e)}), 500

# 🆕 新增路由：支持通过 店铺名称 更新
@shop_bp.route('/update/<path:shop_name>', methods=['POST'])
@shop_bp.route('/shop/update/<path:shop_name>', methods=['POST'])
def update_shop_by_name(shop_name):
    try:
        clean_name = shop_name.strip()
        current_app.logger.info(f"尝试通过名称更新店铺：{clean_name}")

        # 👇 1. 统一获取文件和表单数据
        files = request.files.getlist("pictures")
        data = request.form.to_dict()

        # 👇 2. 打印调试日志
        current_app.logger.info(f"📂 收到文件数量：{len(files)}")
        if files:
            current_app.logger.info(f"📄 文件名列表：{[f.filename for f in files]}")
        else:
            current_app.logger.warning("⚠️ 警告：前端没有发送任何图片文件！")

        # 👇 3. 查找店铺
        all_shops = service.get_all_shops()
        target_shop = None
        
        # 精确匹配
        for s in all_shops:
            if s.name == clean_name:
                target_shop = s
                break
        
        # 忽略大小写匹配
        if not target_shop:
            for s in all_shops:
                if s.name.lower() == clean_name.lower():
                    target_shop = s
                    break

        if not target_shop:
            return jsonify({"error": f"未找到名为 '{clean_name}' 的店铺"}), 404

        auth_user = _require_auth_user()
        if not _can_edit_shop(auth_user, target_shop.id):
            return jsonify({"error": "Unauthorized"}), 401
        data = _sanitize_shop_payload_for_role(data, auth_user)

        current_app.logger.info(f"✅ 找到店铺 ID: {target_shop.id}, 准备更新...")

        # 👇 4. 调用 Service 更新
        updated_shop = service.update_shop(shop_id=target_shop.id, data=data, files=files)

        # ✅ 修改：直接调用 to_dict()
        return jsonify(updated_shop.to_dict())

    except ValueError as ve:
        msg = str(ve)
        if "already exists" in msg.lower():
            return jsonify({"error": msg}), 409
        return jsonify({"error": msg}), 400
    except Exception as e:
        current_app.logger.error(f"Update shop by name failed: {str(e)}", exc_info=True)
        return jsonify({"error": "更新失败", "details": str(e)}), 500

@shop_bp.route('/detail/<path:slug>', methods=['GET'])
@shop_bp.route('/shop/detail/<path:slug>', methods=['GET'])
def get_shop_detail(slug):
    """Single shop for public detail page — avoids downloading full /shops list."""
    shop = service.get_shop_by_slug_or_id(slug)
    if not shop:
        return jsonify({"error": "Not found"}), 404
    return jsonify(shop.to_dict())


@shop_bp.route('/shops', methods=['GET'])
@shop_bp.route('/shop/shops', methods=['GET'])
def get_all_shops():
    auth_user = _require_auth_user()
    keyword = request.args.get('keyword', '').strip()
    shops = service.search_shop(keyword) if keyword else service.get_all_shops()
    editable_ids = _editable_shop_ids(auth_user)

    payload = []
    for shop in shops:
        item = shop.to_dict()
        item["can_edit"] = (editable_ids is None) or (shop.id in editable_ids)
        payload.append(item)
    return jsonify(payload)


@shop_bp.route('/mine', methods=['GET'])
@shop_bp.route('/shop/mine', methods=['GET'])
def get_my_shops():
    auth_user = _require_auth_user()
    if not auth_user:
        return jsonify({"error": "Unauthorized"}), 401

    editable_ids = _editable_shop_ids(auth_user)
    all_shops = service.get_all_shops()
    shops = all_shops if editable_ids is None else [s for s in all_shops if s.id in editable_ids]

    payload = []
    for shop in shops:
        item = shop.to_dict()
        item["can_edit"] = True
        payload.append(item)
    return jsonify(payload)


@shop_bp.route('/admin/users', methods=['GET'])
@shop_bp.route('/shop/admin/users', methods=['GET'])
def list_users_for_admin():
    auth_user = _require_auth_user()
    if not auth_user or not _can_manage_all_shops(auth_user):
        return jsonify({"error": "Unauthorized"}), 401

    users = db.session.query(User).order_by(User.username.asc()).all()
    return jsonify([u.to_dict() for u in users])


@shop_bp.route('/admin/owners', methods=['GET'])
@shop_bp.route('/shop/admin/owners', methods=['GET'])
def list_shop_owners_for_admin():
    auth_user = _require_auth_user()
    if not auth_user or not _can_manage_all_shops(auth_user):
        return jsonify({"error": "Unauthorized"}), 401

    rows = (
        db.session.query(ShopOwner.shop_id, ShopOwner.user_id, User.username)
        .join(User, User.id == ShopOwner.user_id)
        .all()
    )
    return jsonify([
        {
            "shop_id": int(row.shop_id),
            "owner_user_id": int(row.user_id),
            "owner_username": row.username,
        }
        for row in rows
    ])


@shop_bp.route('/admin/transfer-owner', methods=['POST'])
@shop_bp.route('/shop/admin/transfer-owner', methods=['POST'])
def transfer_shop_owner():
    auth_user = _require_auth_user()
    if not auth_user or not _can_manage_all_shops(auth_user):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    shop_id = data.get("shop_id")
    username = (data.get("username") or "").strip()
    if not shop_id or not username:
        return jsonify({"error": "shop_id and username are required"}), 400

    try:
        shop_id = int(shop_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid shop_id"}), 400

    shop = db.session.get(Shop, shop_id)
    if not shop:
        return jsonify({"error": "Shop not found"}), 404

    target_user = db.session.query(User).filter(User.username == username).first()
    if not target_user:
        return jsonify({"error": "Target user not found"}), 404

    db.session.query(ShopOwner).filter(ShopOwner.shop_id == shop_id).delete()
    db.session.add(ShopOwner(shop_id=shop_id, user_id=target_user.id))
    db.session.commit()

    return jsonify({
        "success": True,
        "shop_id": shop_id,
        "owner": target_user.to_dict()
    })


@shop_bp.route('/admin/users/<int:user_id>/permissions', methods=['PATCH'])
@shop_bp.route('/shop/admin/users/<int:user_id>/permissions', methods=['PATCH'])
def update_user_permissions(user_id):
    auth_user = _require_auth_user()
    if not auth_user or not _is_admin_user(auth_user):
        return jsonify({"error": "Unauthorized"}), 401

    target_user = db.session.get(User, user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    if "is_ad_manager" not in data or not isinstance(data.get("is_ad_manager"), bool):
        return jsonify({"error": "is_ad_manager must be a boolean"}), 400

    target_user.is_ad_manager = bool(data["is_ad_manager"])
    db.session.commit()

    return jsonify({"success": True, "user": target_user.to_dict()})