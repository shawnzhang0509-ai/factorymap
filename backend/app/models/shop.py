import os
print(f"🚨🚨🚨 警告：正在加载文件：{os.path.abspath(__file__)} 🚨🚨🚨")

# backend/app/models/shop.py
from app import db

print("💥💥💥 正在加载 shop.py 文件！路径确认！ 💥💥💥")

class Shop(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    badge_text = db.Column(db.String(50))
    new_girls_last_15_days = db.Column(db.Boolean, default=False)

    # 👇 新增这两个字段
    about_me = db.Column(db.Text, nullable=True) 
    additional_price = db.Column(db.String(200), nullable=True)
    filter_city = db.Column(db.String(80), nullable=True)
    min_spend = db.Column(db.Integer, nullable=True)

    # 关联图片
    pictures = db.relationship(
        'Picture',
        secondary='shop_picture',
        back_populates='shops'
    )
    owners = db.relationship(
        'User',
        secondary='shop_owner',
        back_populates='shops'
    )

    # 👇👇👇 修正后的 to_dict 方法 👇👇👇
    def to_dict(self):
        # 1. 手动将图片对象列表转换为字典列表 [{id, url}, ...]
        pics_data = []
        if self.pictures:
            for pic in self.pictures:
                pics_data.append({
                    'id': pic.id,
                    'url': pic.url  # 确保 Picture 模型里有 url 字段
                })

        # 2. 构建主数据字典
        data = {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'phone': self.phone,
            'lat': self.lat,
            'lng': self.lng,
            'badge_text': self.badge_text,
            'new_girls_last_15_days': self.new_girls_last_15_days,
            # 👇 新增字段 (这里会有值了)
            'about_me': self.about_me,
            'additional_price': self.additional_price,
            'filter_city': self.filter_city,
            'min_spend': self.min_spend,
            # 👇 使用转换后的图片数据 (而不是原始对象)
            'pictures': pics_data,
            'can_edit': False
        }
        
        # 👇 调试打印：你可以在后端控制台看到生成的完整 JSON 数据
        print(f"🔍 [DEBUG] to_dict 生成的数据: {data}")
        
        return data