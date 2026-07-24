from app import create_app, db
from app.models.shop import Shop

app = create_app()

# Seed demo factories when the database is empty (China B2B context)
with app.app_context():
    if Shop.query.count() == 0:
        print("🌱 No factories found — creating demo China suppliers…")
        demos = [
            Shop(
                name="Shenzhen Bright Electronics Co.",
                address="Nanshan District, Shenzhen, Guangdong",
                phone="+86-755-0000-1001",
                lat=22.5431,
                lng=114.0579,
                badge_text="Industry Leader, ISO 9001 Certified, Export Experience",
                new_girls_last_15_days=False,
                about_me="Full-service EMS partner for consumer electronics; SMT lines, testing lab, and English-speaking PMs.",
                additional_price="FOB Shenzhen · Typical lead time 20–28 days · Tooling quoted separately",
                filter_city="Pearl River Delta",
                min_spend=3,
                main_product="Consumer electronics & PCBA",
            ),
            Shop(
                name="Suzhou Precision Metalworks",
                address="Suzhou Industrial Park, Jiangsu",
                phone="+86-512-0000-2002",
                lat=31.3160,
                lng=120.7480,
                badge_text="OEM/ODM Specialist, Fast Turnaround",
                new_girls_last_15_days=False,
                about_me="CNC machining, sheet metal, and powder coating for industrial buyers in EU/US.",
                additional_price="Low MOQ pilot runs available · PPAP on request",
                filter_city="Yangtze River Delta",
                min_spend=2,
                main_product="CNC machined components",
            ),
            Shop(
                name="Qingdao Harbor Textiles Ltd.",
                address="Huangdao, Qingdao, Shandong",
                phone="+86-532-0000-3003",
                lat=35.8704,
                lng=120.1964,
                badge_text="Export Experience, Trade Assurance",
                new_girls_last_15_days=False,
                about_me="Knitwear and outdoor fabrics with OEKO-TEX materials; long-term OEM for EU retailers.",
                additional_price="LC at sight available for qualified buyers",
                filter_city="Bohai Economic Rim",
                min_spend=4,
                main_product="Technical textiles & apparel",
            ),
            Shop(
                name="Chongqing WestTech Motors",
                address="Liangjiang New Area, Chongqing",
                phone="+86-23-0000-4004",
                lat=29.5630,
                lng=106.5516,
                badge_text="Industry Leader, OEM/ODM Specialist, Trade Assurance",
                new_girls_last_15_days=False,
                about_me="Brushless DC motors and gearmotors for appliances and mobility OEMs.",
                additional_price="Annual volume agreements preferred · onsite audit welcome",
                filter_city="Central & Western China",
                min_spend=4,
                main_product="Motors & electromechanical assemblies",
            ),
        ]
        for row in demos:
            db.session.add(row)
        db.session.commit()
        print("✅ Demo factories created.")
    else:
        print("ℹ️  Factory data already present — skipping demo seed.")

if __name__ == '__main__':
    print('🚀 API server')
    print('   - http://0.0.0.0:5000')
    print('   - GET /shop/shops')
    app.run(host='0.0.0.0', debug=True, port=5000)
