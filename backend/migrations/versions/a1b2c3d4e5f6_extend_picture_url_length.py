"""extend picture.url for Cloudflare Images delivery URLs

Revision ID: a1b2c3d4e5f6
Revises: f8c9d0e1f2a3
Create Date: 2026-04-25

"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("picture", schema=None) as batch_op:
        batch_op.alter_column(
            "url",
            existing_type=sa.String(length=200),
            type_=sa.String(length=512),
            existing_nullable=False,
        )


def downgrade():
    with op.batch_alter_table("picture", schema=None) as batch_op:
        batch_op.alter_column(
            "url",
            existing_type=sa.String(length=512),
            type_=sa.String(length=200),
            existing_nullable=False,
        )
