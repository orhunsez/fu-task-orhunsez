"""ilk sema

Revision ID: 0001
Revises:
Create Date: 2026-11-07 19:00:41.491644

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "priority IN ('Yüksek', 'Orta', 'Düşük')", name=op.f("ck_tasks_priority")
        ),
        sa.CheckConstraint(
            "status IN ('Yapılacak', 'Devam ediyor', 'Beklemede', 'Bitti')",
            name=op.f("ck_tasks_status"),
        ),
        sa.CheckConstraint("length(trim(title)) > 0", name=op.f("ck_tasks_title_not_blank")),
        sa.ForeignKeyConstraint(
            ["assignee_id"], ["users.id"], name=op.f("fk_tasks_assignee_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_tasks_created_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(op.f("ix_tasks_assignee_id"), "tasks", ["assignee_id"], unique=False)
    op.create_index(op.f("ix_tasks_due_date"), "tasks", ["due_date"], unique=False)
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"], unique=False)
    op.create_table(
        "task_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("changed_by", sa.Integer(), nullable=False),
        sa.Column("field", sa.String(length=20), nullable=False),
        sa.Column("old_value", sa.String(length=50), nullable=True),
        sa.Column("new_value", sa.String(length=50), nullable=True),
        sa.CheckConstraint(
            "field IN ('status', 'assignee_id')", name=op.f("ck_task_history_field")
        ),
        sa.ForeignKeyConstraint(
            ["changed_by"], ["users.id"], name=op.f("fk_task_history_changed_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"], name=op.f("fk_task_history_task_id_tasks")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_history")),
    )
    op.create_index(op.f("ix_task_history_task_id"), "task_history", ["task_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_task_history_task_id"), table_name="task_history")
    op.drop_table("task_history")
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_due_date"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_assignee_id"), table_name="tasks")
    op.drop_table("tasks")
    op.drop_table("users")
