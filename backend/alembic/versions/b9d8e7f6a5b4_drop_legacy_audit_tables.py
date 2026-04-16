"""drop legacy audit tables

Revision ID: b9d8e7f6a5b4
Revises: a8f1c2d3e4b5
Create Date: 2026-03-21 10:30:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "b9d8e7f6a5b4"
down_revision = "a8f1c2d3e4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE project_management_metrics
        DROP COLUMN audit_tasks
        """
    )
    op.execute("DROP TABLE audit_issues")
    op.execute("DROP TABLE audit_tasks")


def downgrade() -> None:
    raise RuntimeError("Downgrade unsupported; restore matching snapshot/backup")
