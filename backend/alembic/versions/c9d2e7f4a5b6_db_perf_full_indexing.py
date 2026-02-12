"""db_perf_full_indexing

Revision ID: c9d2e7f4a5b6
Revises: b3f4d9c2e1a7
Create Date: 2026-02-12 21:05:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "c9d2e7f4a5b6"
down_revision = "b3f4d9c2e1a7"
branch_labels = None
depends_on = None


CONSTRAINT_DDL = [
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_project_members_project_user'
        ) THEN
            ALTER TABLE project_members
                ADD CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id);
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_project_info_project_id'
        ) THEN
            ALTER TABLE project_info
                ADD CONSTRAINT uq_project_info_project_id UNIQUE (project_id);
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_audit_rules_rule_set_code'
        ) THEN
            ALTER TABLE audit_rules
                ADD CONSTRAINT uq_audit_rules_rule_set_code UNIQUE (rule_set_id, rule_code);
        END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_opengrep_rules_name'
        ) THEN
            ALTER TABLE opengrep_rules
                ADD CONSTRAINT uq_opengrep_rules_name UNIQUE (name);
        END IF;
    END $$;
    """,
]

INDEX_DDL = [
    "CREATE INDEX IF NOT EXISTS ix_users_full_name ON users (full_name)",
    "CREATE INDEX IF NOT EXISTS ix_users_role_active_created_at ON users (role, is_active, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_projects_name ON projects (name)",
    "CREATE INDEX IF NOT EXISTS ix_projects_owner_active_created_at ON projects (owner_id, is_active, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_projects_active_updated_at ON projects (is_active, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_projects_name_trgm ON projects USING gin (lower(name) gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS ix_project_members_project_joined_at ON project_members (project_id, joined_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_project_members_user_project ON project_members (user_id, project_id)",
    "CREATE INDEX IF NOT EXISTS ix_audit_tasks_created_by_created_at ON audit_tasks (created_by, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_audit_tasks_project_status_created_at ON audit_tasks (project_id, status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_audit_issues_task_status ON audit_issues (task_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_audit_issues_task_severity ON audit_issues (task_id, severity)",
    "CREATE INDEX IF NOT EXISTS ix_instant_analyses_user_created_at ON instant_analyses (user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_project_info_project_created_at ON project_info (project_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_audit_rule_sets_active_language_type ON audit_rule_sets (is_active, language, rule_type)",
    "CREATE INDEX IF NOT EXISTS ix_audit_rules_rule_set_enabled_sort ON audit_rules (rule_set_id, enabled, sort_order)",
    "CREATE INDEX IF NOT EXISTS ix_prompt_templates_active_type_sort ON prompt_templates (is_active, template_type, sort_order)",
    "CREATE INDEX IF NOT EXISTS ix_prompt_templates_name_trgm ON prompt_templates USING gin (lower(name) gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_rules_active_filters ON opengrep_rules (is_active, language, source, severity, confidence)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_rules_source_correct ON opengrep_rules (source, correct)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_rules_name_trgm ON opengrep_rules USING gin (lower(name) gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_tasks_project_created_at ON opengrep_scan_tasks (project_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_tasks_project_lower_status_created_at ON opengrep_scan_tasks (project_id, lower(status), created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_findings_scan_task_status ON opengrep_findings (scan_task_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_opengrep_findings_scan_task_sev_status_line ON opengrep_findings (scan_task_id, severity, status, start_line)",
    "CREATE INDEX IF NOT EXISTS ix_gitleaks_tasks_project_created_at ON gitleaks_scan_tasks (project_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_gitleaks_tasks_project_lower_status_created_at ON gitleaks_scan_tasks (project_id, lower(status), created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_gitleaks_findings_scan_task_status_created ON gitleaks_findings (scan_task_id, status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_gitleaks_findings_scan_task_file_line ON gitleaks_findings (scan_task_id, file_path, start_line)",
    "CREATE INDEX IF NOT EXISTS ix_gitleaks_findings_fingerprint ON gitleaks_findings (fingerprint)",
    "CREATE INDEX IF NOT EXISTS ix_agent_tasks_project_status_created ON agent_tasks (project_id, status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_tasks_created_by_created ON agent_tasks (created_by, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_events_task_sequence ON agent_events (task_id, sequence)",
    "CREATE INDEX IF NOT EXISTS ix_agent_events_task_created_at ON agent_events (task_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_events_task_type_sequence ON agent_events (task_id, event_type, sequence)",
    "CREATE INDEX IF NOT EXISTS ix_agent_findings_task_status_created ON agent_findings (task_id, status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_findings_task_verified_created ON agent_findings (task_id, is_verified, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_findings_task_severity_created_active ON agent_findings (task_id, severity, created_at DESC) WHERE status <> 'false_positive'",
    "CREATE INDEX IF NOT EXISTS ix_agent_checkpoints_task_created ON agent_checkpoints (task_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_checkpoints_task_agent_created ON agent_checkpoints (task_id, agent_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_agent_tree_nodes_task_depth_created ON agent_tree_nodes (task_id, depth, created_at)",
]

DROP_INDEX_DDL = [
    "DROP INDEX IF EXISTS ix_agent_tree_nodes_task_depth_created",
    "DROP INDEX IF EXISTS ix_agent_checkpoints_task_agent_created",
    "DROP INDEX IF EXISTS ix_agent_checkpoints_task_created",
    "DROP INDEX IF EXISTS ix_agent_findings_task_severity_created_active",
    "DROP INDEX IF EXISTS ix_agent_findings_task_verified_created",
    "DROP INDEX IF EXISTS ix_agent_findings_task_status_created",
    "DROP INDEX IF EXISTS ix_agent_events_task_type_sequence",
    "DROP INDEX IF EXISTS ix_agent_events_task_created_at",
    "DROP INDEX IF EXISTS ix_agent_events_task_sequence",
    "DROP INDEX IF EXISTS ix_agent_tasks_created_by_created",
    "DROP INDEX IF EXISTS ix_agent_tasks_project_status_created",
    "DROP INDEX IF EXISTS ix_gitleaks_findings_fingerprint",
    "DROP INDEX IF EXISTS ix_gitleaks_findings_scan_task_file_line",
    "DROP INDEX IF EXISTS ix_gitleaks_findings_scan_task_status_created",
    "DROP INDEX IF EXISTS ix_gitleaks_tasks_project_lower_status_created_at",
    "DROP INDEX IF EXISTS ix_gitleaks_tasks_project_created_at",
    "DROP INDEX IF EXISTS ix_opengrep_findings_scan_task_sev_status_line",
    "DROP INDEX IF EXISTS ix_opengrep_findings_scan_task_status",
    "DROP INDEX IF EXISTS ix_opengrep_tasks_project_lower_status_created_at",
    "DROP INDEX IF EXISTS ix_opengrep_tasks_project_created_at",
    "DROP INDEX IF EXISTS ix_opengrep_rules_name_trgm",
    "DROP INDEX IF EXISTS ix_opengrep_rules_source_correct",
    "DROP INDEX IF EXISTS ix_opengrep_rules_active_filters",
    "DROP INDEX IF EXISTS ix_prompt_templates_name_trgm",
    "DROP INDEX IF EXISTS ix_prompt_templates_active_type_sort",
    "DROP INDEX IF EXISTS ix_audit_rules_rule_set_enabled_sort",
    "DROP INDEX IF EXISTS ix_audit_rule_sets_active_language_type",
    "DROP INDEX IF EXISTS ix_project_info_project_created_at",
    "DROP INDEX IF EXISTS ix_instant_analyses_user_created_at",
    "DROP INDEX IF EXISTS ix_audit_issues_task_severity",
    "DROP INDEX IF EXISTS ix_audit_issues_task_status",
    "DROP INDEX IF EXISTS ix_audit_tasks_project_status_created_at",
    "DROP INDEX IF EXISTS ix_audit_tasks_created_by_created_at",
    "DROP INDEX IF EXISTS ix_project_members_user_project",
    "DROP INDEX IF EXISTS ix_project_members_project_joined_at",
    "DROP INDEX IF EXISTS ix_projects_name_trgm",
    "DROP INDEX IF EXISTS ix_projects_active_updated_at",
    "DROP INDEX IF EXISTS ix_projects_owner_active_created_at",
    "DROP INDEX IF EXISTS ix_projects_name",
    "DROP INDEX IF EXISTS ix_users_role_active_created_at",
    "DROP INDEX IF EXISTS ix_users_full_name",
]

DROP_CONSTRAINT_DDL = [
    "ALTER TABLE opengrep_rules DROP CONSTRAINT IF EXISTS uq_opengrep_rules_name",
    "ALTER TABLE audit_rules DROP CONSTRAINT IF EXISTS uq_audit_rules_rule_set_code",
    "ALTER TABLE project_info DROP CONSTRAINT IF EXISTS uq_project_info_project_id",
    "ALTER TABLE project_members DROP CONSTRAINT IF EXISTS uq_project_members_project_user",
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    for ddl in CONSTRAINT_DDL:
        op.execute(ddl)

    for ddl in INDEX_DDL:
        op.execute(ddl)


def downgrade() -> None:
    for ddl in DROP_INDEX_DDL:
        op.execute(ddl)

    for ddl in DROP_CONSTRAINT_DDL:
        op.execute(ddl)
