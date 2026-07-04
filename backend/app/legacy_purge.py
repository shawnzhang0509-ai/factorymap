"""Detect and remove legacy Excel-imported factory listings after MBTI pivot."""

from __future__ import annotations

from typing import Optional

from app import db
from app.models.shop import Shop
from app.models.site_page import SitePage
from app.repositories.shop_repository import ShopRepository

MIGRATION_MARKER_SLUG = "_migration_legacy_factory_purged"

VALID_MBTI = {
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
}

FACTORY_REGIONS = {
    "Pearl River Delta",
    "Yangtze River Delta",
    "Bohai Economic Rim",
    "Bohai Rim",
    "Central & Western China",
}


def _primary_mbti(badge_text: Optional[str]) -> Optional[str]:
    token = (badge_text or "").strip().upper().split(",")[0].strip()
    return token if token in VALID_MBTI else None


def _looks_like_legacy_factory(shop: Shop) -> bool:
    if _primary_mbti(shop.badge_text):
        return False

    name = shop.name or ""
    product = shop.main_product or ""
    about = shop.about_me or ""
    region = (shop.filter_city or "").strip()

    if region in FACTORY_REGIONS:
        return True
    if "有限公司" in name or "Co." in name or "Ltd" in name:
        return True
    if "家具" in product or "制造" in product or "factory" in product.lower():
        return True
    if "统一社会信用代码" in about or "注册资本" in about:
        return True
    return False


def _migration_already_done() -> bool:
    return (
        db.session.query(SitePage.id)
        .filter(SitePage.slug == MIGRATION_MARKER_SLUG)
        .first()
        is not None
    )


def _mark_migration_done(deleted_count: int) -> None:
    row = SitePage.query.filter_by(slug=MIGRATION_MARKER_SLUG).first()
    if row:
        row.content_html = str(deleted_count)
        return
    db.session.add(
        SitePage(
            slug=MIGRATION_MARKER_SLUG,
            content_html=str(deleted_count),
        )
    )


def auto_purge_legacy_factory_import_once() -> int:
    """
    One-time cleanup: if the DB still holds bulk-imported factory rows (no MBTI profiles),
    delete them on the next API deploy. Returns number of rows deleted (0 if skipped).
    """
    if _migration_already_done():
        return 0

    shops = Shop.query.all()
    total = len(shops)
    if total == 0:
        _mark_migration_done(0)
        db.session.commit()
        return 0

    mbti_count = sum(1 for s in shops if _primary_mbti(s.badge_text))
    factory_like = sum(1 for s in shops if _looks_like_legacy_factory(s))

    # Bulk factory Excel import: hundreds of rows, zero MBTI types
    should_purge = (
        (total >= 20 and mbti_count == 0)
        or (total >= 50 and factory_like >= total * 0.5)
        or (factory_like >= 10 and mbti_count == 0)
    )

    if not should_purge:
        return 0

    deleted = ShopRepository().purge_all_shops()
    _mark_migration_done(deleted)
    db.session.commit()
    print(
        f"🧹 Auto-purged {deleted} legacy factory listing(s) "
        f"(total={total}, mbti={mbti_count}, factory_like={factory_like})"
    )
    return deleted
