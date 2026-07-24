from app.repositories.shop_repository import ShopRepository

class ShopService:
    def __init__(self):
        self.repo = ShopRepository()

    def get_all_shops(self):
        return self.repo.get_all_shops()  # ✅ 委托给 repo

    def search_shop(self, content):
        return self.repo.get_all_shops(content=content)  # 注意：方法名也建议统一

    def get_shop_by_slug_or_id(self, identifier):
        return self.repo.get_shop_by_slug_or_id(identifier)

    def add_shop(self, data, files):
        return self.repo.add_shop(data, files)

    def del_shop(self, id):
        self.repo.del_shop(id)
        return True

    def update_shop(self, shop_id, data, files):
        return self.repo.update_shop(shop_id, data, files)