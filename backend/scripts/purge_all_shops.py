#!/usr/bin/env python3
"""Delete every shop/profile row (legacy factory import cleanup).

Usage (from backend/):
  DATABASE_URL=postgresql://... python3 scripts/purge_all_shops.py

Or set PURGE_ALL_SHOPS_ONCE=1 on Render and redeploy the API service.
"""

from app import create_app
from app.repositories.shop_repository import ShopRepository


def main() -> None:
    app = create_app()
    with app.app_context():
        deleted = ShopRepository().purge_all_shops()
        print(f"Deleted {deleted} listing(s).")


if __name__ == "__main__":
    main()
