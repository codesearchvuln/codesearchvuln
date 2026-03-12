"""add_bandit_tables

Revision ID: f2a1b3c4d5e6
Revises: e1a2b3c4d5f6
Create Date: 2026-03-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2a1b3c4d5e6"
down_revision = "e1a2b3c4d5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bandit_scan_tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("target_path", sa.String(), nullable=False),
        sa.Column("total_findings", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("high_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("medium_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("low_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("high_confidence_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("scan_duration_ms", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("files_scanned", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_bandit_tasks_project_created_at",
        "bandit_scan_tasks",
        ["project_id", "created_at"],
    )
    op.create_index(
        "ix_bandit_tasks_project_lower_status_created_at",
        "bandit_scan_tasks",
        ["project_id", "status", "created_at"],
    )

    op.create_table(
        "bandit_findings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("scan_task_id", sa.String(), sa.ForeignKey("bandit_scan_tasks.id"), nullable=False),
        sa.Column("test_id", sa.String(), nullable=False),
        sa.Column("test_name", sa.String(), nullable=True),
        sa.Column("issue_text", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("issue_severity", sa.String(), nullable=False, server_default=sa.text("'LOW'")),
        sa.Column("issue_confidence", sa.String(), nullable=False, server_default=sa.text("'LOW'")),
        sa.Column("code", sa.Text(), nullable=True),
        sa.Column("more_info", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'open'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_bandit_findings_scan_task_status_created",
        "bandit_findings",
        ["scan_task_id", "status", "created_at"],
    )
    op.create_index(
        "ix_bandit_findings_scan_task_file_line",
        "bandit_findings",
        ["scan_task_id", "file_path", "line_number"],
    )
    op.create_index("ix_bandit_findings_test_id", "bandit_findings", ["test_id"])


def downgrade() -> None:
    op.drop_index("ix_bandit_findings_test_id", table_name="bandit_findings")
    op.drop_index("ix_bandit_findings_scan_task_file_line", table_name="bandit_findings")
    op.drop_index("ix_bandit_findings_scan_task_status_created", table_name="bandit_findings")
    op.drop_table("bandit_findings")

    op.drop_index(
        "ix_bandit_tasks_project_lower_status_created_at",
        table_name="bandit_scan_tasks",
    )
    op.drop_index("ix_bandit_tasks_project_created_at", table_name="bandit_scan_tasks")
    op.drop_table("bandit_scan_tasks")

