"""add project report column to agent_tasks

Revision ID: a8f1c2d3e4b5
Revises: 90a71996ac03
Create Date: 2026-03-20 12:40:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "a8f1c2d3e4b5"
down_revision = "90a71996ac03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE agent_tasks
        ADD COLUMN IF NOT EXISTS report TEXT
        """
    )


def downgrade() -> None:
    pass
