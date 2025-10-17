import asyncpg
import os
import logging

logger = logging.getLogger(__name__)

async def create_tables(pool: asyncpg.Pool) -> None:
    """Create database tables if they don't exist."""
    
    # Create flood_predictions table
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS flood_predictions (
            id SERIAL PRIMARY KEY,
            city TEXT,
            risk_score FLOAT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Create sos_reports table
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS sos_reports (
            id SERIAL PRIMARY KEY,
            text TEXT,
            latitude FLOAT,
            longitude FLOAT,
            image_url TEXT,
            verified BOOLEAN DEFAULT FALSE,
            severity TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    logger.info("Database tables created/verified")

async def init_database() -> asyncpg.Pool:
    """Initialize database connection pool and create tables."""
    
    # Build connection string from environment variables
    postgres_user = os.getenv("POSTGRES_USER", "postgres")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    postgres_db = os.getenv("POSTGRES_DB", "safetynet")
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    
    dsn = f"postgres://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}"
    
    # Create connection pool
    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=10,
        command_timeout=60
    )
    
    # Create tables
    await create_tables(pool)
    
    logger.info("Connected to PostgreSQL")
    return pool