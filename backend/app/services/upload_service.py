import os
from flask import current_app

# 允许的文件后缀
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif'}


def allowed_file(filename: str) -> bool:
    """检查文件后缀是否合法"""
    return (
        '.' in filename and
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def _cf_images_configured() -> bool:
    return bool(
        os.getenv('CLOUDFLARE_ACCOUNT_ID')
        and os.getenv('CLOUDFLARE_IMAGES_API_TOKEN')
        and os.getenv('CLOUDFLARE_ACCOUNT_HASH')
    )


def _upload_cloudflare_images(file) -> tuple[str, str]:
    """Upload to Cloudflare Images; return (delivery_url, image_id)."""
    import requests

    account_id = os.getenv('CLOUDFLARE_ACCOUNT_ID', '').strip()
    api_token = os.getenv('CLOUDFLARE_IMAGES_API_TOKEN', '').strip()
    account_hash = os.getenv('CLOUDFLARE_ACCOUNT_HASH', '').strip()

    url = f'https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1'
    headers = {'Authorization': f'Bearer {api_token}'}

    file.stream.seek(0)
    filename = file.filename or 'upload.jpg'
    mime = file.mimetype or 'application/octet-stream'
    files = {'file': (filename, file.stream, mime)}

    resp = requests.post(url, headers=headers, files=files, timeout=120)
    try:
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f'Cloudflare Images invalid JSON: {resp.text[:500]}') from e

    if not data.get('success'):
        errs = data.get('errors') or data
        raise RuntimeError(f'Cloudflare Images upload failed: {errs}')

    result = data.get('result') or {}
    image_id = result.get('id')
    variants = result.get('variants') or []
    if not image_id:
        raise RuntimeError('Cloudflare Images response missing result.id')

    # Prefer variant named "public", else first delivery URL
    delivery = None
    for v in variants:
        if isinstance(v, str) and v.endswith('/public'):
            delivery = v
            break
    if not delivery and variants:
        delivery = variants[0] if isinstance(variants[0], str) else None
    if not delivery:
        variant = os.getenv('CLOUDFLARE_IMAGES_DEFAULT_VARIANT', 'public').strip() or 'public'
        delivery = f'https://imagedelivery.net/{account_hash}/{image_id}/{variant}'

    return delivery, image_id


def _upload_cloudinary(file) -> tuple[str, str]:
    import cloudinary
    import cloudinary.uploader

    if not cloudinary.config().cloud_name:
        cloudinary.config(
            cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
            api_key=os.getenv('CLOUDINARY_API_KEY'),
            api_secret=os.getenv('CLOUDINARY_API_SECRET'),
        )

    upload_result = cloudinary.uploader.upload(
        file,
        folder='nz_massage_images',
        allowed_formats=['jpg', 'jpeg', 'png', 'webp'],
    )
    return upload_result['secure_url'], upload_result['public_id']


def save_uploaded_file(file):
    """
    Upload image to Cloudflare Images (preferred) or Cloudinary (legacy fallback).

    Returns:
        (url, secondary_id) — url is stored in Picture.url; secondary_id is CF image id
        or Cloudinary public_id for optional cleanup.
    """
    if _cf_images_configured():
        try:
            return _upload_cloudflare_images(file)
        except Exception as e:
            current_app.logger.error(f'Cloudflare Images upload failed: {e}')
            raise

    if os.getenv('CLOUDINARY_CLOUD_NAME') and os.getenv('CLOUDINARY_API_KEY'):
        try:
            return _upload_cloudinary(file)
        except Exception as e:
            current_app.logger.error(f'Cloudinary upload failed: {e}')
            raise

    raise RuntimeError(
        'No image backend configured. Set CLOUDFLARE_ACCOUNT_ID, '
        'CLOUDFLARE_IMAGES_API_TOKEN, CLOUDFLARE_ACCOUNT_HASH for Cloudflare Images, '
        'or CLOUDINARY_* for Cloudinary.'
    )
