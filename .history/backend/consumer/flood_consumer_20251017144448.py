import asyncio
import json
import logging
import os
import time
from typing import Dict, Any, Optional, List

import asyncpg
import numpy as np
from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError
import lightgbm as lgb
import mlflow
import mlflow.lightgbm
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FloodRiskConsumer:
    """Async Kafka consumer for weather data processing and flood risk prediction."""
    
    def __init__(self) -> None:
        # Configuration from environment
        self.kafka_bootstrap = os.getenv("KAFKA_BROKER", "localhost:9092")
        self.weather_topic = os.getenv("KAFKA_TOPIC_WEATHER", "weather_stream")
        self.postgres_dsn = self._build_postgres_dsn()
        self.model_path = os.getenv("MODEL_PATH", "backend/models/flood_model.txt")
        
        # MLflow configuration
        self.mlflow_tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
        self.mlflow_experiment = os.getenv("MLFLOW_EXPERIMENT", "flood-risk-prediction")
        
        # Consumer state
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.db_pool: Optional[asyncpg.Pool] = None
        self.model: Optional[lgb.Booster] = None
        self.running = False
        
        # Metrics tracking
        self.processed_count = 0
        self.error_count = 0
        self.start_time = time.time()
    
    def _build_postgres_dsn(self) -> str:
        """Build PostgreSQL connection string from environment variables."""
        user = os.getenv("POSTGRES_USER", "postgres")
        password = os.getenv("POSTGRES_PASSWORD", "postgres")
        db = os.getenv("POSTGRES_DB", "safetynet")
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        return f"postgres://{user}:{password}@{host}:{port}/{db}"
    
    async def init_database(self) -> None:
        """Initialize PostgreSQL connection pool."""
        try:
            self.db_pool = await asyncpg.create_pool(
                dsn=self.postgres_dsn,
                min_size=1,
                max_size=5,
                command_timeout=60
            )
            logger.info("Connected to PostgreSQL")
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    async def init_kafka_consumer(self) -> None:
        """Initialize Kafka consumer."""
        try:
            self.consumer = AIOKafkaConsumer(
                self.weather_topic,
                bootstrap_servers=self.kafka_bootstrap,
                group_id="flood-risk-consumer",
                auto_offset_reset="latest",
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                enable_auto_commit=True,
                auto_commit_interval_ms=1000,
                session_timeout_ms=30000,
                heartbeat_interval_ms=10000,
            )
            await self.consumer.start()
            logger.info(f"Kafka consumer started for topic: {self.weather_topic}")
        except Exception as e:
            logger.error(f"Kafka consumer initialization failed: {e}")
            raise
    
    def load_model(self) -> None:
        """Load the LightGBM flood risk model."""
        try:
            if not os.path.exists(self.model_path):
                logger.warning(f"Model file not found: {self.model_path}")
                logger.info("Creating a dummy model for testing...")
                self._create_dummy_model()
                return
            
            self.model = lgb.Booster(model_file=self.model_path)
            logger.info(f"LightGBM model loaded from: {self.model_path}")
        except Exception as e:
            logger.error(f"Model loading failed: {e}")
            logger.info("Creating a dummy model for testing...")
            self._create_dummy_model()
    
    def _create_dummy_model(self) -> None:
        """Create a dummy model for testing when real model is not available."""
        # Create a simple dummy model that returns random risk scores
        logger.info("Creating dummy model for testing...")
        
        # Create dummy training data
        np.random.seed(42)
        n_samples = 1000
        X = np.random.rand(n_samples, 3)  # temp, humidity, rain1h
        y = np.random.rand(n_samples)    # random risk scores
        
        # Train a simple LightGBM model
        train_data = lgb.Dataset(X, label=y)
        params = {
            'objective': 'regression',
            'metric': 'rmse',
            'boosting_type': 'gbdt',
            'num_leaves': 31,
            'learning_rate': 0.05,
            'feature_fraction': 0.9,
            'verbose': -1
        }
        
        self.model = lgb.train(params, train_data, num_boost_round=100)
        
        # Save the dummy model
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        self.model.save_model(self.model_path)
        logger.info(f"Dummy model created and saved to: {self.model_path}")
    
    def predict_flood_risk(self, weather_data: Dict[str, Any]) -> float:
        """Predict flood risk score from weather data."""
        try:
            # Extract features: temp, humidity, rain1h
            features = np.array([[
                weather_data.get('temp', 20.0),
                weather_data.get('humidity', 50.0),
                weather_data.get('rain1h', 0.0)
            ]])
            
            # Predict risk score (0-1)
            assert self.model is not None, "Model not loaded"
            risk_score = self.model.predict(features)[0]
            
            # Ensure score is between 0 and 1
            risk_score = max(0.0, min(1.0, risk_score))
            
            return float(risk_score)
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            # Return random score as fallback
            return float(np.random.rand())
    
    async def save_prediction(self, city: str, risk_score: float) -> None:
        """Save flood prediction to PostgreSQL."""
        try:
            assert self.db_pool is not None, "DB pool not initialized"
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO flood_predictions (city, risk_score, created_at)
                    VALUES ($1, $2, NOW())
                """, city, risk_score)
                
        except Exception as e:
            logger.error(f"Database save failed: {e}")
            raise
    
    async def log_metrics_to_mlflow(self, risk_scores: List[float], latency_ms: float) -> None:
        """Log prediction metrics to MLflow."""
        try:
            # Set MLflow tracking URI
            mlflow.set_tracking_uri(self.mlflow_tracking_uri)
            
            # Set or create experiment
            try:
                experiment = mlflow.get_experiment_by_name(self.mlflow_experiment)
                if experiment is None:
                    experiment_id = mlflow.create_experiment(self.mlflow_experiment)
                else:
                    experiment_id = experiment.experiment_id
            except Exception:
                experiment_id = mlflow.create_experiment(self.mlflow_experiment)
            
            with mlflow.start_run(experiment_id=experiment_id):
                # Log metrics
                mlflow.log_metric("avg_risk_score", float(np.mean(risk_scores)))
                mlflow.log_metric("max_risk_score", float(np.max(risk_scores)))
                mlflow.log_metric("min_risk_score", float(np.min(risk_scores)))
                mlflow.log_metric("risk_std", float(np.std(risk_scores)))
                mlflow.log_metric("prediction_latency_ms", latency_ms)
                mlflow.log_metric("processed_count", self.processed_count)
                mlflow.log_metric("error_count", self.error_count)
                
                # Log model info
                mlflow.log_param("model_path", self.model_path)
                mlflow.log_param("kafka_topic", self.weather_topic)
                
                logger.info(f"Metrics logged to MLflow: avg_risk={np.mean(risk_scores):.3f}, latency={latency_ms:.1f}ms")
                
        except Exception as e:
            logger.warning(f"MLflow logging failed: {e}")
    
    async def process_weather_message(self, message: Dict[str, Any]) -> None:
        """Process a single weather message."""
        start_time = time.time()
        
        try:
            # Extract city and weather data
            city = message.get('city', 'unknown')
            
            # Handle different message formats
            if 'weather' in message:
                # Format: {"city": "Boston", "weather": {"temp": 16.42, ...}}
                weather_data = message.get('weather', {})
            else:
                # Format: {"city": "Boston,US", "temp": 16.42, "humidity": 52, ...}
                weather_data = {
                    'temp': message.get('temp', 20.0),
                    'humidity': message.get('humidity', 50.0),
                    'rain1h': message.get('rain1h', 0.0)
                }
            
            if not weather_data:
                logger.warning(f"No weather data in message: {message}")
                return
            
            # Predict flood risk
            risk_score = self.predict_flood_risk(weather_data)
            
            # Save to database
            await self.save_prediction(city, risk_score)
            
            # Update metrics
            self.processed_count += 1
            latency_ms = (time.time() - start_time) * 1000
            
            logger.info(f"Processed {city}: risk={risk_score:.3f}, latency={latency_ms:.1f}ms")
            
            # Log metrics every 10 predictions
            if self.processed_count % 10 == 0:
                await self.log_metrics_to_mlflow([risk_score], latency_ms)
                
        except Exception as e:
            self.error_count += 1
            logger.error(f"Message processing failed: {e}")
            logger.error(f"Message content: {message}")
    
    async def consume_messages(self) -> None:
        """Main message consumption loop."""
        logger.info("Starting message consumption...")
        
        try:
            assert self.consumer is not None, "Kafka consumer not initialized"
            async for message in self.consumer:
                try:
                    # Process the message
                    await self.process_weather_message(message.value)
                    
                except Exception as e:
                    logger.error(f"Message processing error: {e}")
                    self.error_count += 1
                    
        except KafkaError as e:
            logger.error(f"Kafka error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in consumption loop: {e}")
            raise
    
    async def start(self) -> None:
        """Start the flood risk consumer."""
        logger.info("Starting Flood Risk Consumer...")
        
        try:
            # Initialize components
            await self.init_database()
            await self.init_kafka_consumer()
            self.load_model()
            
            # Initialize MLflow
            mlflow.set_tracking_uri(self.mlflow_tracking_uri)
            
            self.running = True
            logger.info("Flood Risk Consumer started successfully!")
            
            # Start consuming messages
            await self.consume_messages()
            
        except Exception as e:
            logger.error(f"Startup failed: {e}")
            raise
    
    async def stop(self) -> None:
        """Stop the consumer gracefully."""
        logger.info("Stopping Flood Risk Consumer...")
        
        self.running = False
        
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")
        
        if self.db_pool:
            await self.db_pool.close()
            logger.info("Database pool closed")
        
        # Log final metrics
        runtime = time.time() - self.start_time
        logger.info(f"Final stats: processed={self.processed_count}, errors={self.error_count}, runtime={runtime:.1f}s")
        
        logger.info("Flood Risk Consumer stopped")

async def main():
    """Main entry point."""
    consumer = FloodRiskConsumer()
    
    try:
        await consumer.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        await consumer.stop()

if __name__ == "__main__":
    asyncio.run(main())