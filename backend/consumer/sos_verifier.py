import asyncio
import json
import logging
import os
import io
from typing import Any, Dict, Optional

import asyncpg
import torch
import requests
import torchvision.models as models
import torchvision.transforms as transforms
from aiokafka import AIOKafkaConsumer
from PIL import Image
from transformers import AutoTokenizer, AutoModelForSequenceClassification

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("sos_verifier")

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────
POSTGRES_DSN = os.getenv(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@localhost:5432/safetynet"
)
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC = os.getenv("KAFKA_TOPIC_SOS", "sos_reports")

# ─────────────────────────────────────────────────────────────
# Model initialization (loaded once at startup)
# ─────────────────────────────────────────────────────────────
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
text_model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased")
text_model.eval()

resnet = models.resnet50(pretrained=True)
resnet.eval()

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

# ─────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────
def analyze_text(text: str) -> float:
    """Return urgency probability from text using BERT."""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        outputs = text_model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        score = probs[0, 1].item() if outputs.logits.shape[1] > 1 else probs[0, 0].item()
    return float(score)

def analyze_image(image_url: str) -> float:
    """Return flood-likelihood score from image using ResNet."""
    try:
        resp = requests.get(image_url, timeout=10)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        tensor = transform(img).unsqueeze(0)
        with torch.no_grad():
            outputs = resnet(tensor)
            probs = torch.nn.functional.softmax(outputs, dim=1)
            # class 917 ≈ “flood” in ImageNet
            flood_score = probs[0, 917].item() if probs.shape[1] > 917 else float(probs.mean())
        return float(flood_score)
    except Exception as e:
        logger.warning(f"Image analysis failed: {e}")
        return 0.0

async def init_db() -> asyncpg.Pool:
    """Create DB connection pool."""
    pool = await asyncpg.create_pool(dsn=POSTGRES_DSN, min_size=1, max_size=5)
    async with pool.acquire() as conn:
        await conn.execute("""
        CREATE TABLE IF NOT EXISTS verified_sos_reports (
            id SERIAL PRIMARY KEY,
            text TEXT,
            image_url TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            text_score DOUBLE PRECISION,
            image_score DOUBLE PRECISION,
            verified BOOLEAN,
            created_at TIMESTAMP DEFAULT NOW()
        );
        """)
    return pool

async def save_report(pool: asyncpg.Pool, report: Dict[str, Any]) -> None:
    """Insert verified SOS report into PostgreSQL."""
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO verified_sos_reports
            (text, image_url, latitude, longitude, text_score, image_score, verified)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        """,
        report["text"],
        report["image_url"],
        report["latitude"],
        report["longitude"],
        report["text_score"],
        report["image_score"],
        report["verified"],
    )

# ─────────────────────────────────────────────────────────────
# Consumer class
# ─────────────────────────────────────────────────────────────
class SOSVerifier:
    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.db_pool: Optional[asyncpg.Pool] = None

    async def start(self):
        logger.info("Starting SOS Verifier consumer...")
        self.db_pool = await init_db()
        self.consumer = AIOKafkaConsumer(
            TOPIC,
            bootstrap_servers=KAFKA_BROKER,
            group_id="sos-verifier-group",
            auto_offset_reset="latest",
            value_deserializer=lambda m: json.loads(m.decode("utf-8"))
        )
        await self.consumer.start()
        logger.info(f"Connected to Kafka topic: {TOPIC}")
        await self.consume()

    async def consume(self):
        assert self.consumer and self.db_pool
        async for msg in self.consumer:
            try:
                data = msg.value
                text = data.get("text", "")
                lat = data.get("latitude")
                lon = data.get("longitude")
                image_url = data.get("image_url") or data.get("file_url")

                text_score = analyze_text(text)
                image_score = analyze_image(image_url) if image_url else 0.0
                verified = (text_score > 0.6 and image_score > 0.4)

                record = {
                    "text": text,
                    "image_url": image_url,
                    "latitude": lat,
                    "longitude": lon,
                    "text_score": text_score,
                    "image_score": image_score,
                    "verified": verified,
                }

                await save_report(self.db_pool, record)
                print(f"DEBUG image raw score: {image_score}")
                logger.info(
                    f"Processed SOS: verified={verified} "
                    f"text={text_score:.2f}, img={image_score:.2f}"
                )
            except Exception as e:
                logger.error(f"Failed to process message: {e}")

    async def stop(self):
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped.")
        if self.db_pool:
            await self.db_pool.close()
            logger.info("Database connection closed.")

# ─────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────
async def main():
    verifier = SOSVerifier()
    try:
        await verifier.start()
    except KeyboardInterrupt:
        logger.info("Interrupted by user.")
    finally:
        await verifier.stop()

if __name__ == "__main__":
    asyncio.run(main())