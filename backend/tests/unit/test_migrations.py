import asyncio
from pathlib import Path

import asyncpg
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.core.config import settings

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "migrations" / "alembic.ini"
SCRATCH_DB = "velio_migrations"


async def _psql(sql: str, database: str):
    connection = await asyncpg.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=database,
    )
    try:
        return await connection.fetch(sql)
    finally:
        await connection.close()


def test_every_migration_goes_up_down_and_up_again(monkeypatch):
    asyncio.run(_psql(f"DROP DATABASE IF EXISTS {SCRATCH_DB}", settings.db_name))
    asyncio.run(_psql(f"CREATE DATABASE {SCRATCH_DB}", settings.db_name))
    monkeypatch.setattr(settings, "db_name", SCRATCH_DB)
    config = Config(str(ALEMBIC_INI))
    head = ScriptDirectory.from_config(config).get_current_head()

    command.upgrade(config, "head")
    command.downgrade(config, "base")
    tables = asyncio.run(
        _psql(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            " AND tablename <> 'alembic_version'",
            SCRATCH_DB,
        )
    )
    assert tables == []
    command.upgrade(config, "head")

    version = asyncio.run(_psql("SELECT version_num FROM alembic_version", SCRATCH_DB))
    assert [row["version_num"] for row in version] == [head]
