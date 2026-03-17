"""Merge project metrics and yasa/phpstan heads.

This revision resolves the concurrent heads introduced by the
project-management metrics migration and the yasa/phpstan merge migration.
It does not change schema objects.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5f6a7b8c9d0e"
down_revision: Union[str, Sequence[str], None] = (
    "048836873140",
    "e5f6a7b8c9d0",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge revision: no-op.
    op.execute("SELECT 1")


def downgrade() -> None:
    # Split merged heads: no-op.
    op.execute("SELECT 1")
