from datetime import datetime, timedelta
import secrets

from werkzeug.security import check_password_hash, generate_password_hash

from app import db


class EmailOtp(db.Model):
    __tablename__ = "email_otps"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    code_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    @staticmethod
    def generate_code() -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    @classmethod
    def issue(cls, email: str, ttl_seconds: int = 600) -> str:
        code = cls.generate_code()
        row = cls(
            email=email,
            code_hash=generate_password_hash(code),
            expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds),
        )
        db.session.add(row)
        db.session.commit()
        return code

    def verify(self, code: str, max_attempts: int = 5) -> bool:
        if datetime.utcnow() > self.expires_at:
            return False
        if self.attempts >= max_attempts:
            return False
        self.attempts += 1
        db.session.commit()
        return check_password_hash(self.code_hash, code)

    @classmethod
    def recent_request_count(cls, email: str, window_seconds: int = 3600) -> int:
        since = datetime.utcnow() - timedelta(seconds=window_seconds)
        return (
            db.session.query(cls)
            .filter(cls.email == email, cls.created_at >= since)
            .count()
        )
