import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate  # <--- 修改点 1
from flask_cors import CORS
from sqlalchemy import inspect, text

db = SQLAlchemy()
migrate = Migrate()  # <--- 修改点 2


def _ensure_shop_filter_city_column():
    """
    db.create_all() does not ALTER existing tables. If deploy skips migrations,
    ORM queries fail (ProgrammingError / undefined column). Add missing column once.
    """
    try:
        engine = db.engine
        insp = inspect(engine)
        if not insp.has_table("shop"):
            return
        names = {c["name"] for c in insp.get_columns("shop")}
        if "filter_city" in names:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE shop ADD COLUMN filter_city VARCHAR(80)"))
        print("✅ Added missing column shop.filter_city (schema sync)")
    except Exception as e:
        print(f"⚠️ shop.filter_city schema check skipped: {e}")


def _ensure_shop_min_spend_column():
    try:
        engine = db.engine
        insp = inspect(engine)
        if not insp.has_table("shop"):
            return
        names = {c["name"] for c in insp.get_columns("shop")}
        if "min_spend" in names:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE shop ADD COLUMN min_spend INTEGER"))
        print("✅ Added missing column shop.min_spend (schema sync)")
    except Exception as e:
        print(f"⚠️ shop.min_spend schema check skipped: {e}")


def _ensure_shop_main_product_column():
    try:
        engine = db.engine
        insp = inspect(engine)
        if not insp.has_table("shop"):
            return
        names = {c["name"] for c in insp.get_columns("shop")}
        if "main_product" in names:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE shop ADD COLUMN main_product VARCHAR(200)"))
        print("✅ Added missing column shop.main_product (schema sync)")
    except Exception as e:
        print(f"⚠️ shop.main_product schema check skipped: {e}")


def _ensure_shop_social_columns():
    try:
        engine = db.engine
        insp = inspect(engine)
        if not insp.has_table("shop"):
            return
        names = {c["name"] for c in insp.get_columns("shop")}
        with engine.begin() as conn:
            if "social_xhs" not in names:
                conn.execute(text("ALTER TABLE shop ADD COLUMN social_xhs VARCHAR(200)"))
                print("✅ Added missing column shop.social_xhs (schema sync)")
            if "social_bilibili" not in names:
                conn.execute(text("ALTER TABLE shop ADD COLUMN social_bilibili VARCHAR(200)"))
                print("✅ Added missing column shop.social_bilibili (schema sync)")
    except Exception as e:
        print(f"⚠️ shop social columns schema check skipped: {e}")


def _ensure_user_ad_manager_column():
    try:
        engine = db.engine
        insp = inspect(engine)
        if not insp.has_table("users"):
            return
        names = {c["name"] for c in insp.get_columns("users")}
        if "is_ad_manager" in names:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_ad_manager BOOLEAN NOT NULL DEFAULT false"))
        print("✅ Added missing column users.is_ad_manager (schema sync)")
    except Exception as e:
        print(f"⚠️ users.is_ad_manager schema check skipped: {e}")


def _ensure_user_email_column():
    try:
        engine = db.engine
        insp = inspect(engine)
        if not insp.has_table("users"):
            return
        names = {c["name"] for c in insp.get_columns("users")}
        if "email" in names:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"))
        print("✅ Added missing column users.email (schema sync)")
    except Exception as e:
        print(f"⚠️ users.email schema check skipped: {e}")


_LEGACY_PAGE_MARKERS = (
    "massage",
    "therapist",
    "spa service",
    "18 years of age",
    "18+",
    "new zealand massage",
    "massageshop",
)


def _auto_purge_legacy_factory_import_once():
    try:
        from app.legacy_purge import auto_purge_legacy_factory_import_once

        auto_purge_legacy_factory_import_once()
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ legacy factory auto-purge skipped: {e}")


def _maybe_seed_demo_profiles():
    try:
        from app.demo_seed import seed_demo_profiles_if_empty

        created = seed_demo_profiles_if_empty()
        if created:
            print(f"🌱 Seeded {created} demo MBTI profile(s)")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ demo seed skipped: {e}")


def _maybe_purge_factory_data_once():
    """One-time ops switch: set PURGE_ALL_SHOPS_ONCE=1 on Render, redeploy, then remove it."""
    if os.environ.get("PURGE_ALL_SHOPS_ONCE") != "1":
        return
    try:
        from app.repositories.shop_repository import ShopRepository

        deleted = ShopRepository().purge_all_shops()
        print(f"🧹 PURGE_ALL_SHOPS_ONCE removed {deleted} legacy listing(s) from the database")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ PURGE_ALL_SHOPS_ONCE failed: {e}")


def _migrate_legacy_site_pages():
    """Clear CMS HTML left over from the massage-map era so B2B fallbacks show."""
    try:
        from app.models.site_page import SitePage

        rows = db.session.query(SitePage).filter(SitePage.slug.in_(("about", "terms"))).all()
        changed = 0
        for row in rows:
            html = (row.content_html or "").strip()
            if not html:
                continue
            lower = html.lower()
            if any(marker in lower for marker in _LEGACY_PAGE_MARKERS):
                row.content_html = ""
                changed += 1
        if changed:
            db.session.commit()
            print(f"✅ Cleared legacy massage-map HTML from {changed} site page(s)")
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ site_pages legacy cleanup skipped: {e}")


def create_app():
    app = Flask(__name__)

    # ... (前面的数据库配置代码保持不变) ...
    basedir_app = os.path.abspath(os.path.dirname(__file__))
    project_root = os.path.dirname(basedir_app) 
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        print("✅ 已连接到 Render PostgreSQL 数据库")
    else:
        db_path = os.path.join(project_root, 'dev.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path.replace('\\', '/')
        print(f"⚠️ 未检测到 DATABASE_URL，正在使用本地 SQLite: {db_path}")

    app.config['ADMIN_DELETE_TOKEN'] = 'my_super_secret_delete_token'
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    app.config['FILES_FOLDER'] = os.path.join(basedir_app, 'uploads') 
    
    if not os.path.exists(app.config['FILES_FOLDER']):
        os.makedirs(app.config['FILES_FOLDER'])

    db.init_app(app)
    migrate.init_app(app, db)  # <--- 修改点 3：这是解决 'No such command db' 的关键！

    CORS(app) # 允许所有来源，开发调试最方便

    # ==========================================
    # 👇 修改点 1：导入新的 ClickStat 模型
    # ==========================================
    from app.models.shop import Shop
    from app.models.picture import Picture
    from app.models.association import ShopPicture
    from app.models.click_stat import ClickStat  # <--- 新增这一行
    from app.models.user import User
    from app.models.email_otp import EmailOtp  # noqa: F401 — register table
    from app.models.shop_owner import ShopOwner
    from app.models.site_page import SitePage  # noqa: F401 — register table

    # ==========================================
    # 👇 修改点 2：注册 tracking 蓝图
    # ==========================================
    from app.routes.shop import shop_bp
    from app.routes.user import user_bp
    from app.routes.tracking import tracking_bp  # <--- 新增导入
    from app.routes.pages import pages_bp

    app.register_blueprint(shop_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(tracking_bp)
    app.register_blueprint(pages_bp) 

    # ... (后面的文件服务和路由保持不变) ...
    @app.route('/files/<path:filename>')
    def serve_files(filename):
        return send_from_directory(app.config['FILES_FOLDER'], filename)

    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        return send_from_directory(app.config['FILES_FOLDER'], filename)

    # 自动创建表结构；并对已存在的库补齐 ORM 新增列（避免未跑 migrate 时 ProgrammingError）
    with app.app_context():
        db.create_all()
        _ensure_shop_filter_city_column()
        _ensure_shop_min_spend_column()
        _ensure_shop_main_product_column()
        _ensure_shop_social_columns()
        _ensure_user_ad_manager_column()
        _ensure_user_email_column()
        _migrate_legacy_site_pages()
        _maybe_purge_factory_data_once()
        _auto_purge_legacy_factory_import_once()
        _maybe_seed_demo_profiles()

    @app.route('/')
    def home():
        return "<h1>MBTI Social Map API</h1><p>Flask backend is running.</p>"
        
    return app