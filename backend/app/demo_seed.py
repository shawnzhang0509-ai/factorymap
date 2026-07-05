"""Demo MBTI profiles when the database has no listings."""

from app import db
from app.models.shop import Shop


def seed_demo_profiles_if_empty() -> int:
    if Shop.query.count() > 0:
        return 0

    demos = [
        Shop(
            name="小雨",
            address="静安区, 上海",
            phone="+86-138-0000-1001",
            lat=31.2304,
            lng=121.4737,
            badge_text="ENFP",
            new_girls_last_15_days=True,
            about_me="爱咖啡、摄影和周末徒步。INFP 朋友们都说我很会倾听。",
            additional_price="friends,activity",
            filter_city="长三角",
            min_spend=26,
            main_product="Coffee, Photography, Hiking",
        ),
        Shop(
            name="Alex",
            address="南山区, 深圳",
            phone="+86-139-0000-2002",
            lat=22.5431,
            lng=114.0579,
            badge_text="INTJ",
            new_girls_last_15_days=False,
            about_me="Product designer by day. Looking for thoughtful conversations and board game nights.",
            additional_price="friends,networking",
            filter_city="珠三角",
            min_spend=29,
            main_product="Design, Board games, Tech",
        ),
        Shop(
            name="Mia",
            address="朝阳区, 北京",
            phone="+86-136-0000-3003",
            lat=39.9042,
            lng=116.4074,
            badge_text="INFJ",
            new_girls_last_15_days=False,
            about_me="喜欢读书、独立音乐和逛博物馆。慢热但真诚。",
            additional_price="friends,dating",
            filter_city="京津冀",
            min_spend=24,
            main_product="Reading, Music, Art",
        ),
        Shop(
            name="Chris",
            address="西湖区, 杭州",
            phone="+86-137-0000-4004",
            lat=30.2741,
            lng=120.1551,
            badge_text="ESTP",
            new_girls_last_15_days=True,
            about_me="Outdoor sports addict — climbing, cycling, and trying new restaurants.",
            additional_price="activity,friends",
            filter_city="长三角",
            min_spend=27,
            main_product="Fitness, Food, Travel",
        ),
    ]
    for row in demos:
        db.session.add(row)
    db.session.commit()
    return len(demos)
