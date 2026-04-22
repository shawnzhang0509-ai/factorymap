"""add min_spend to shop

Revision ID: f8c9d0e1f2a3
Revises: e7a1b2c3d4e5
Create Date: 2026-04-22

"""
from alembic import op
import sqlalchemy as sa

revision = "f8c9d0e1f2a3"
down_revision = "e7a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("shop", schema=None) as batch_op:
        batch_op.add_column(sa.Column("min_spend", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("shop", schema=None) as batch_op:
        batch_op.drop_column("min_spend")
