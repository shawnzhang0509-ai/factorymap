import re
from collections import defaultdict
from flask import Blueprint, request, jsonify
from app.models.click_stat import ClickStat
from app.models.shop import Shop
from app.models.shop_owner import ShopOwner
from app import db
from datetime import datetime
from sqlalchemy import func, cast, String
from app.utils.auth import get_auth_user

tracking_bp = Blueprint('tracking', __name__)


def _normalize_shop_id(raw_shop_id):
    """
    Normalize shop ID from payload/URL.
    Accepts values like: 12, "12", "shop_12", "shop-12".
    Returns int or None when invalid.
    """
    if raw_shop_id is None:
        return None

    if isinstance(raw_shop_id, int):
        return raw_shop_id

    raw = str(raw_shop_id).strip()
    if not raw:
        return None

    if raw.isdigit():
        return int(raw)

    match = re.match(r"^shop[_-]?(\d+)$", raw, re.IGNORECASE)
    if match:
        return int(match.group(1))

    return None


def _shop_id_candidates(normalized_shop_id):
    """
    Return all compatible shop_id representations used in legacy data.
    Example for 8: {"8", "shop_8", "shop-8"}.
    """
    if normalized_shop_id is None:
        return set()
    return {
        str(normalized_shop_id),
        f"shop_{normalized_shop_id}",
        f"shop-{normalized_shop_id}",
    }


def _parse_date_param(value, field_name):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"Invalid {field_name}, expected YYYY-MM-DD")


def _is_admin_user(user):
    return bool(user and user.is_admin)


def _require_admin_user():
    user = get_auth_user(request)
    if not _is_admin_user(user):
        return None
    return user


def _can_view_shop_stats(user, shop_id):
    if not user:
        return False
    if _is_admin_user(user):
        return True
    if getattr(user, "is_ad_manager", False):
        return False
    owner = ShopOwner.query.filter_by(shop_id=shop_id, user_id=user.id).first()
    return owner is not None

# ==========================================
# 1. 写入接口 (保持不变)
# ==========================================
@tracking_bp.route('/track/action', methods=['POST'])
def track_action():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        raw_shop_id = data.get('shop_id')
        shop_id = _normalize_shop_id(raw_shop_id)
        action_type = data.get('type')
        phone = data.get('phone')

        if not shop_id or not action_type:
            return jsonify({"error": "Missing required parameters"}), 400

        stat = ClickStat(
            shop_id=shop_id,
            action_type=action_type,
            count=1,
            created_at=datetime.utcnow()
        )

        db.session.add(stat)
        db.session.commit()

        return jsonify({"status": "success", "message": "Tracked", "shop_id": shop_id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ==========================================
# 2. 单个店铺统计 (保持不变)
# ==========================================
@tracking_bp.route('/stats/<shop_id>', methods=['GET'])
def get_stats(shop_id):
    try:
        auth_user = get_auth_user(request)
        normalized_shop_id = _normalize_shop_id(shop_id)
        if normalized_shop_id is None:
            return jsonify({"error": "Invalid shop_id"}), 400
        if not _can_view_shop_stats(auth_user, normalized_shop_id):
            return jsonify({"error": "Unauthorized"}), 401

        # Use cast(..., String) so query works whether DB column is int or text.
        candidates = _shop_id_candidates(normalized_shop_id)
        records = ClickStat.query.filter(
            cast(ClickStat.shop_id, String).in_(list(candidates))
        ).all()
        shop = Shop.query.get(normalized_shop_id)

        sms_count = sum(r.count for r in records if r.action_type == 'sms')
        call_count = sum(r.count for r in records if r.action_type == 'call')

        return jsonify({
            "shop_id": normalized_shop_id,
            "shop_name": shop.name if shop else "Unknown Shop Name",
            "sms": sms_count,
            "call": call_count,
            "total": sms_count + call_count
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# 3. 全局统计 (新增！给 Admin 页面用的)
# ==========================================
@tracking_bp.route('/stats/all', methods=['GET'])
def get_all_stats():
    """
    获取所有店铺的统计数据
    使用 SQL GROUP BY 进行聚合，效率最高
    """
    try:
        if not _require_admin_user():
            return jsonify({"error": "Unauthorized"}), 401

        # Aggregate by raw stored value first, then merge in Python by normalized ID.
        # This avoids SQL type mismatch issues in legacy schemas (text vs int).
        grouped_rows = db.session.query(
            cast(ClickStat.shop_id, String).label("raw_shop_id"),
            ClickStat.action_type,
            func.sum(ClickStat.count).label("count")
        ).group_by(
            cast(ClickStat.shop_id, String),
            ClickStat.action_type
        ).all()

        aggregated = defaultdict(lambda: {"sms": 0, "call": 0, "total": 0})

        for row in grouped_rows:
            normalized = _normalize_shop_id(row.raw_shop_id)
            key = normalized if normalized is not None else row.raw_shop_id
            count = int(row.count or 0)

            if row.action_type == "sms":
                aggregated[key]["sms"] += count
            elif row.action_type == "call":
                aggregated[key]["call"] += count
            aggregated[key]["total"] += count

        numeric_shop_ids = [k for k in aggregated.keys() if isinstance(k, int)]
        shop_name_map = {}
        if numeric_shop_ids:
            shops = Shop.query.filter(Shop.id.in_(numeric_shop_ids)).all()
            shop_name_map = {shop.id: shop.name for shop in shops}

        json_results = []
        for key, metrics in aggregated.items():
            shop_id_value = key
            shop_name_value = (
                shop_name_map.get(key, "Unknown Shop Name")
                if isinstance(key, int)
                else "Unknown Shop Name"
            )
            json_results.append({
                "shop_id": shop_id_value,
                "shop_name": shop_name_value,
                "sms": metrics["sms"],
                "call": metrics["call"],
                "total": metrics["total"]
            })

        json_results.sort(key=lambda item: item["total"], reverse=True)

        return jsonify(json_results), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tracking_bp.route('/stats/<shop_id>/daily', methods=['GET'])
def get_shop_daily_stats(shop_id):
    """
    单个店铺按天统计：返回每天 sms/call/total
    """
    try:
        auth_user = get_auth_user(request)
        normalized_shop_id = _normalize_shop_id(shop_id)
        if normalized_shop_id is None:
            return jsonify({"error": "Invalid shop_id"}), 400
        if not _can_view_shop_stats(auth_user, normalized_shop_id):
            return jsonify({"error": "Unauthorized"}), 401

        start_date = _parse_date_param(request.args.get("start_date"), "start_date")
        end_date = _parse_date_param(request.args.get("end_date"), "end_date")
        if start_date and end_date and start_date > end_date:
            return jsonify({"error": "start_date must be <= end_date"}), 400

        candidates = _shop_id_candidates(normalized_shop_id)
        query = db.session.query(
            func.date(ClickStat.created_at).label("stat_date"),
            ClickStat.action_type,
            func.sum(ClickStat.count).label("count")
        ).filter(
            cast(ClickStat.shop_id, String).in_(list(candidates))
        )

        if start_date:
            query = query.filter(func.date(ClickStat.created_at) >= start_date)
        if end_date:
            query = query.filter(func.date(ClickStat.created_at) <= end_date)

        rows = query.group_by(
            func.date(ClickStat.created_at),
            ClickStat.action_type
        ).all()

        by_date = defaultdict(lambda: {"sms": 0, "call": 0, "total": 0})
        for row in rows:
            if row.stat_date is None:
                continue
            date_key = row.stat_date.isoformat()
            count = int(row.count or 0)
            if row.action_type == "sms":
                by_date[date_key]["sms"] += count
            elif row.action_type == "call":
                by_date[date_key]["call"] += count
            by_date[date_key]["total"] += count

        daily = [
            {
                "date": date_key,
                "sms": metrics["sms"],
                "call": metrics["call"],
                "total": metrics["total"]
            }
            for date_key, metrics in by_date.items()
        ]
        daily.sort(key=lambda item: item["date"], reverse=True)

        shop = Shop.query.get(normalized_shop_id)
        return jsonify({
            "shop_id": normalized_shop_id,
            "shop_name": shop.name if shop else "Unknown Shop Name",
            "daily": daily
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tracking_bp.route('/stats/daily-summary', methods=['GET'])
def get_daily_summary():
    """
    全店铺按天统计汇总：每行 = 某天 + 某店铺
    """
    try:
        if not _require_admin_user():
            return jsonify({"error": "Unauthorized"}), 401

        start_date = _parse_date_param(request.args.get("start_date"), "start_date")
        end_date = _parse_date_param(request.args.get("end_date"), "end_date")
        if start_date and end_date and start_date > end_date:
            return jsonify({"error": "start_date must be <= end_date"}), 400

        query = db.session.query(
            func.date(ClickStat.created_at).label("stat_date"),
            cast(ClickStat.shop_id, String).label("raw_shop_id"),
            ClickStat.action_type,
            func.sum(ClickStat.count).label("count")
        )

        if start_date:
            query = query.filter(func.date(ClickStat.created_at) >= start_date)
        if end_date:
            query = query.filter(func.date(ClickStat.created_at) <= end_date)

        rows = query.group_by(
            func.date(ClickStat.created_at),
            cast(ClickStat.shop_id, String),
            ClickStat.action_type
        ).all()

        aggregated = defaultdict(lambda: {"sms": 0, "call": 0, "total": 0})
        for row in rows:
            if row.stat_date is None:
                continue
            normalized = _normalize_shop_id(row.raw_shop_id)
            shop_key = normalized if normalized is not None else row.raw_shop_id
            key = (row.stat_date.isoformat(), shop_key)
            count = int(row.count or 0)
            if row.action_type == "sms":
                aggregated[key]["sms"] += count
            elif row.action_type == "call":
                aggregated[key]["call"] += count
            aggregated[key]["total"] += count

        numeric_shop_ids = [k[1] for k in aggregated.keys() if isinstance(k[1], int)]
        shop_name_map = {}
        if numeric_shop_ids:
            shops = Shop.query.filter(Shop.id.in_(numeric_shop_ids)).all()
            shop_name_map = {shop.id: shop.name for shop in shops}

        result = []
        for (date_key, shop_key), metrics in aggregated.items():
            result.append({
                "date": date_key,
                "shop_id": shop_key,
                "shop_name": shop_name_map.get(shop_key, "Unknown Shop Name") if isinstance(shop_key, int) else "Unknown Shop Name",
                "sms": metrics["sms"],
                "call": metrics["call"],
                "total": metrics["total"]
            })

        result.sort(key=lambda item: (item["date"], item["total"]), reverse=True)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500