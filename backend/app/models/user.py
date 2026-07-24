from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app
from app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_ad_manager = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    shops = db.relationship(
        'Shop',
        secondary='shop_owner',
        back_populates='owners'
    )

    def set_password(self, raw_password: str):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    @staticmethod
    def _serializer():
        return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])

    def issue_access_token(self) -> str:
        return self._serializer().dumps({"user_id": self.id})

    @staticmethod
    def verify_access_token(token: str, max_age: int = 7 * 24 * 3600):
        if not token:
            return None
        try:
            payload = User._serializer().loads(token, max_age=max_age)
            user_id = payload.get("user_id")
            if not user_id:
                return None
            return db.session.get(User, user_id)
        except (BadSignature, SignatureExpired):
            return None

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "is_admin": self.is_admin,
            "is_ad_manager": self.is_ad_manager,
        }
