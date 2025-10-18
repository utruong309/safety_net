from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Any, Dict
import asyncpg
from aiokafka import AIOKafkaProducer
import os
import json
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import our custom modules
from backend.db.init_db import init_database  # noqa: E402
from backend.utils.minio_utils import minio_client, MinIOClient  # noqa: E402

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "safetynet")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
KAFKA_TOPIC_SOS = os.getenv("KAFKA_TOPIC_SOS", "sos_reports")
KAFKA_TOPIC_WEATHER = os.getenv("KAFKA_TOPIC_WEATHER", "weather_stream")

app = FastAPI(title="SafetyNet API", version="0.1.0")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def init_kafka(app: FastAPI) -> None:
    """Initialize Kafka producer."""
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BROKER, 
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    await producer.start()
    app.state.kafka_producer = producer
    logger.info("Kafka producer ready")


@app.on_event("startup")
async def on_startup() -> None:
    """Initialize all services on startup."""
    logger.info("Starting SafetyNet API...")
    
    # Initialize database
    app.state.db_pool = await init_database()
    
    # Initialize Kafka
    await init_kafka(app)
    
    # Initialize MinIO
    minio_client.ensure_bucket_exists()
    app.state.minio_client = minio_client
    logger.info("MinIO client initialized")
    
    logger.info("SafetyNet API startup complete!")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Gracefully shutdown all services."""
    logger.info("Shutting down SafetyNet API...")
    
    # Close Kafka producer
    producer: Optional[AIOKafkaProducer] = getattr(app.state, "kafka_producer", None)
    if producer is not None:
        try:
            await producer.stop()
            logger.info("Kafka producer stopped")
        except Exception as e:
            logger.error(f"Error stopping Kafka producer: {e}")
    
    # Close database pool
    pool: Optional[asyncpg.pool.Pool] = getattr(app.state, "db_pool", None)
    if pool is not None:
        try:
            await pool.close()
            logger.info("Database pool closed")
        except Exception as e:
            logger.error(f"Error closing database pool: {e}")
    
    logger.info("SafetyNet API shutdown complete")


async def upload_to_minio(file: UploadFile) -> str:
    """Upload file to MinIO and return public URL."""
    minio_client: MinIOClient = app.state.minio_client
    return await minio_client.upload_file(file)


@app.post("/sos/report")
async def create_sos_report(
    text: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    file: Optional[UploadFile] = File(None),
) -> Dict[str, Any]:
    image_url = ""
    if file is not None:
        image_url = await upload_to_minio(file)

    message = {
        "text": text,
        "latitude": latitude,
        "longitude": longitude,
        "image_url": image_url or None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Save to database
    pool: asyncpg.pool.Pool = app.state.db_pool
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO sos_reports (text, latitude, longitude, image_url, status, verified, created_at)
                VALUES ($1, $2, $3, $4, 'verified', true, NOW())
            """, text, latitude, longitude, image_url or None)
    except Exception as e:
        logger.error(f"Database insert failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database save failed: {e}")

    # Publish to Kafka
    producer: AIOKafkaProducer = app.state.kafka_producer
    try:
        await producer.send_and_wait(KAFKA_TOPIC_SOS, message)
    except Exception as e:
        logger.error(f"Kafka publish failed: {e}")
        # Don't fail the request if Kafka is down, data is already saved to DB

    return {"status": "uploaded", "message": message}


async def fetch_rows(query: str) -> List[Dict[str, Any]]:
    pool: asyncpg.pool.Pool = app.state.db_pool
    async with pool.acquire() as conn:
        records = await conn.fetch(query)
        return [dict(r) for r in records]


@app.get("/risk/latest")
async def get_risk_latest() -> List[Dict[str, Any]]:
    query = """
        SELECT *
        FROM flood_predictions
        ORDER BY created_at DESC
        LIMIT 10
    """
    try:
        rows = await fetch_rows(query)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {e}")


@app.get("/sos/recent")
async def get_sos_recent() -> List[Dict[str, Any]]:
    query = """
        SELECT *
        FROM sos_reports
        ORDER BY created_at DESC
        LIMIT 10
    """
    try:
        rows = await fetch_rows(query)
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {e}")


# Health endpoint
@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}