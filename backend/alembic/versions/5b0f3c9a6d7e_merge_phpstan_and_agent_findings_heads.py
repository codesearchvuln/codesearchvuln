"""merge phpstan and agent findings heads

Revision ID: 5b0f3c9a6d7e
Revises: a7b8c9d0e1f2, c4b1a7e8d9f0
Create Date: 2026-03-13 20:45:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "5b0f3c9a6d7e"
down_revision = ("a7b8c9d0e1f2", "c4b1a7e8d9f0")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
