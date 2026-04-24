# backend/app/models/picture.py
from app import db

class Picture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(512), nullable=False)

    # 反向关联
    shops = db.relationship(
        'Shop',
        secondary='shop_picture',  # ✅ 同样用字符串
        back_populates='pictures'
    )