import os
import smtplib
from email.message import EmailMessage

import requests
from flask import current_app


def _email_from() -> str:
    return (
        os.environ.get("EMAIL_FROM")
        or current_app.config.get("EMAIL_FROM")
        or "hello@mbtisocialmap.app"
    )


def _send_via_resend(to_email: str, subject: str, text_body: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")

    res = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": _email_from(),
            "to": [to_email],
            "subject": subject,
            "text": text_body,
        },
        timeout=20,
    )
    if not res.ok:
        raise RuntimeError(f"Resend error: {res.status_code} {res.text[:200]}")


def _send_via_smtp(to_email: str, subject: str, text_body: str) -> None:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    if not host or not user or not password:
        raise RuntimeError("SMTP_HOST/SMTP_USER/SMTP_PASSWORD is not configured")

    msg = EmailMessage()
    msg["From"] = _email_from()
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.send_message(msg)


def send_login_code_email(to_email: str, code: str) -> None:
    subject = "MBTI 社交地图登录验证码"
    text_body = (
        f"你的登录验证码是：{code}\n\n"
        f"验证码 10 分钟内有效，请勿泄露给他人。\n"
        f"如非本人操作，请忽略此邮件。"
    )

    provider = (os.environ.get("EMAIL_PROVIDER") or "auto").strip().lower()
    dev_log = os.environ.get("EMAIL_DEV_LOG", "").strip() in ("1", "true", "yes")

    if provider == "console" or (provider == "auto" and dev_log):
        current_app.logger.warning("EMAIL_DEV_LOG: login code for %s is %s", to_email, code)
        return

    if provider in ("auto", "resend") and os.environ.get("RESEND_API_KEY"):
        _send_via_resend(to_email, subject, text_body)
        return

    if provider in ("auto", "smtp") and os.environ.get("SMTP_HOST"):
        _send_via_smtp(to_email, subject, text_body)
        return

    if dev_log:
        current_app.logger.warning("EMAIL_DEV_LOG: login code for %s is %s", to_email, code)
        return

    raise RuntimeError(
        "Email is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASSWORD."
    )
