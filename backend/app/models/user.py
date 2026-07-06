from datetime import datetime
import re
import secrets
from typing import Optional
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app
from app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
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
            "email": self.email,
            "is_admin": self.is_admin,
            "is_ad_manager": self.is_ad_manager,
        }

    @staticmethod
    def normalize_email(raw: str) -> Optional[str]:
        email = (raw or "").strip().lower()
        if not email or "@" not in email or len(email) > 255:
            return None
        return email

    @classmethod
    def find_by_email(cls, email: str):
        return db.session.query(cls).filter(cls.email == email).first()

    @classmethod
    def username_from_email(cls, email: str) -> str:
        local = email.split("@", 1)[0]
        base = re.sub(r"[^a-zA-Z0-9_\-]", "", local)[:40] or "user"
        candidate = base
        n = 1
        while db.session.query(cls.id).filter(cls.username == candidate).first():
            suffix = str(n)
            candidate = f"{base[: max(1, 40 - len(suffix))]}{suffix}"
            n += 1
        return candidate

    @classmethod
    def get_or_create_by_email(cls, email: str):
        user = cls.find_by_email(email)
        if user:
            return user, False
        user = cls(
            username=cls.username_from_email(email),
            email=email,
            is_admin=False,
            is_ad_manager=False,
        )
        user.set_password(secrets.token_urlsafe(32))
        db.session.add(user)
        db.session.commit()
        return user, True
