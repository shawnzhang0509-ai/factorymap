import os
import re
import uuid
from flask import current_app
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app import db
from app.models.shop import Shop
from app.models.picture import Picture
from app.models.association import ShopPicture
from app.services.upload_service import save_uploaded_file


def _slug_from_shop_name(name: str) -> str:
    """Match frontend: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')"""
    return re.sub(r'[^a-z0-9]+', '-', (name or '').lower())


def _shop_name_key(name) -> str:
    """Case-insensitive trimmed name for duplicate checks (matches slug stability goal)."""
    return (name or "").strip().lower()


def _parse_min_spend(raw):
    """MOQ tier 1–4 stored in min_spend; legacy currency values → None."""
    if raw is None or raw == '':
        return None
    try:
        n = int(float(str(raw).strip()))
    except (TypeError, ValueError):
        return None
    if n == 0:
        return None
    if 1 <= n <= 4:
        return n
    return None


class ShopRepository:
    def __init__(self):
        self.db = db

    def _existing_shop_id_for_name(self, name: str, exclude_shop_id=None):
        want = _shop_name_key(name)
        if not want:
            return None
        q = self.db.session.query(Shop.id, Shop.name)
        for sid, sname in q.all():
            if exclude_shop_id is not None and sid == exclude_shop_id:
                continue
            if _shop_name_key(sname) == want:
                return sid
        return None

    def get_all_shops(self, content=None):
        """根据关键词搜索店铺"""
        query = self.db.session.query(Shop)
        query = query.options(joinedload(Shop.pictures))

        if content and content.strip():
            query = query.filter(
                or_(
                    Shop.name.ilike(f"%{content}%"),
                    Shop.address.ilike(f"%{content}%")
                )
            )
        return query.all()

    def get_by_id(self, shop_id):
        """根据 ID 获取店铺"""
        return self.db.session.query(Shop).get(shop_id)

    def get_shop_by_slug_or_id(self, identifier: str):
        """
        Public detail: resolve slug (from name) or numeric id with minimal work.
        Two-step query avoids loading every shop's pictures like GET /shops.
        """
        ident = (identifier or '').strip()
        if not ident:
            return None
        if ident.isdigit():
            return (
                self.db.session.query(Shop)
                .options(joinedload(Shop.pictures))
                .filter(Shop.id == int(ident))
                .first()
            )
        want = ident.lower()
        rows = self.db.session.query(Shop.id, Shop.name).all()
        for sid, name in rows:
            if _slug_from_shop_name(name or '') == want:
                return (
                    self.db.session.query(Shop)
                    .options(joinedload(Shop.pictures))
                    .filter(Shop.id == sid)
                    .first()
                )
        return None

    def add_shop(self, data=None, files=None):
        """添加新店铺及关联图片"""
        data = data or {}
        files = files or []

        dup_id = self._existing_shop_id_for_name(data.get("name"))
        if dup_id is not None:
            raise ValueError("A shop with this name already exists. Choose a different name.")

        # 处理布尔字段
        new_girls = data.get("new_girls_last_15_days", False)
        if isinstance(new_girls, str):
            new_girls = new_girls.lower() == "true"

        # 创建店铺 (包含新增的 about_me 和 additional_price)
        shop = Shop(
            name=data.get('name'),
            address=data.get('address'),
            phone=data.get('phone'),
            lat=data.get('lat'),
            lng=data.get('lng'),
            badge_text=data.get('badge_text'),
            new_girls_last_15_days=new_girls,
            about_me=data.get('about_me', ''),
            additional_price=data.get('additional_price', ''),
            filter_city=(data.get('filter_city') or '').strip() or None,
            min_spend=_parse_min_spend(data.get('min_spend')),
            main_product=(data.get('main_product') or '').strip() or None,
        )

        self.db.session.add(shop)
        self.db.session.flush()

        # 保存图片 (现在 save_uploaded_file 返回的是 https:// 链接)
        for f in files:
            file_name, _ = save_uploaded_file(f)
            picture = Picture(url=file_name)
            self.db.session.add(picture)
            self.db.session.flush()

            shop_picture = ShopPicture(shop_id=shop.id, picture_id=picture.id)
            self.db.session.add(shop_picture)

        self.db.session.commit()
        return shop

    def update_shop(self, shop_id, data=None, files=None):
        """更新店铺信息及图片"""
        data = data or {}
        files = files or []

        shop = self.get_by_id(shop_id)
        if not shop:
            raise ValueError("Shop not found")

        if "name" in data:
            dup_id = self._existing_shop_id_for_name(data.get("name"), exclude_shop_id=shop_id)
            if dup_id is not None:
                raise ValueError("A shop with this name already exists. Choose a different name.")

        # 1. 更新基础字段
        fields = ["name", "address", "phone", "lat", "lng", "badge_text"]
        for field in fields:
            if field in data:
                setattr(shop, field, data[field])
        
        # 2. 更新新增字段
        if 'about_me' in data:
            shop.about_me = data['about_me']
        if 'additional_price' in data:
            shop.additional_price = data['additional_price']
        if 'filter_city' in data:
            fc = data.get('filter_city')
            shop.filter_city = (fc or '').strip() or None
        if 'min_spend' in data:
            shop.min_spend = _parse_min_spend(data.get('min_spend'))
        if 'main_product' in data:
            mp = data.get('main_product')
            shop.main_product = (mp or '').strip() or None

        # 3. 更新布尔字段
        new_girls = data.get("new_girls_last_15_days")
        if new_girls is not None:
            if isinstance(new_girls, str):
                new_girls = new_girls.lower() == "true"
            shop.new_girls_last_15_days = new_girls

        # --- 🔥 纯云端图片逻辑 (已移除所有 os.remove 和本地路径操作) ---

        # A. 处理明确要删除的图片
        remove_ids_str = data.get("remove_picture_ids", "")
        if remove_ids_str:
            try:
                remove_ids = [int(i) for i in remove_ids_str.split(",") if i.strip()]
                if remove_ids:
                    shop_pictures = (
                        self.db.session.query(ShopPicture)
                        .filter(
                            ShopPicture.shop_id == shop.id,
                            ShopPicture.picture_id.in_(remove_ids)
                        )
                        .all()
                    )
                    picture_ids = [sp.picture_id for sp in shop_pictures]

                    # ✅ 仅删除数据库记录，云端文件保留作为备份 (或手动在 Cloudinary 控制台清理)
                    for pic in self.db.session.query(Picture).filter(Picture.id.in_(picture_ids)):
                        self.db.session.delete(pic)

                    for sp in shop_pictures:
                        self.db.session.delete(sp)
                    
                    current_app.logger.info(f"已移除 {len(picture_ids)} 张图片的数据库关联。")
            except (ValueError, TypeError):
                pass

        # B. 新上传的图片：追加到现有列表（不再清空全部旧图；避免“加一张顶掉全部”）
        if files:
            current_app.logger.info(f"检测到 {len(files)} 张新图片，追加到店铺 {shop_id}…")

        for f in files:
            file_name, _ = save_uploaded_file(f)
            picture = Picture(url=file_name)
            self.db.session.add(picture)
            self.db.session.flush()

            shop_picture = ShopPicture(shop_id=shop.id, picture_id=picture.id)
            self.db.session.add(shop_picture)
            current_app.logger.info(f"新图片已添加: {file_name}")

        # --- 🔥 修改结束 ---

        self.db.session.commit()
        return shop

    def del_shop(self, shop_id: int):
        """删除店铺及其所有关联图片记录"""
        shop = self.get_by_id(shop_id)
        if not shop:
            return False, "Shop not found"

        try:
            shop_pictures = (
                self.db.session.query(ShopPicture)
                .filter(ShopPicture.shop_id == shop_id)
                .all()
            )
            picture_ids = [sp.picture_id for sp in shop_pictures]

            # ✅ 仅删除数据库记录，不再尝试物理删除文件
            for pic in self.db.session.query(Picture).filter(Picture.id.in_(picture_ids)):
                self.db.session.delete(pic)

            for sp in shop_pictures:
                self.db.session.delete(sp)

            self.db.session.delete(shop)
            self.db.session.commit()

            return True, "Shop deleted successfully"

        except Exception as e:
            self.db.session.rollback()
            current_app.logger.error(f"删除店铺失败: {str(e)}")
            return False, str(e)