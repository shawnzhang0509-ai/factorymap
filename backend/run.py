from app import create_app
from app.demo_seed import seed_demo_profiles_if_empty

app = create_app()

with app.app_context():
    created = seed_demo_profiles_if_empty()
    if created:
        print(f"✅ Seeded {created} demo MBTI profile(s).")
    else:
        print("ℹ️  Profile data already present — skipping demo seed.")

if __name__ == '__main__':
    print('🚀 MBTI Social Map API')
    print('   - http://0.0.0.0:5000')
    print('   - GET /shop/shops')
    app.run(host='0.0.0.0', debug=True, port=5000)
