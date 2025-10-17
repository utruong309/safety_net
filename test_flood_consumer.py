#!/usr/bin/env python3
"""
Test script for the flood risk consumer.
Sends sample weather data to Kafka topic for processing.
"""

import asyncio
import json
import time
from datetime import datetime, timezone
from aiokafka import AIOKafkaProducer

async def send_test_weather_data():
    """Send sample weather data to Kafka for testing."""
    
    # Initialize Kafka producer
    producer = AIOKafkaProducer(
        bootstrap_servers="localhost:9092",
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    
    try:
        await producer.start()
        print("✅ Kafka producer started")
        
        # Sample weather data for different cities
        weather_samples = [
            {
                "city": "New York",
                "weather": {
                    "temp": 22.5,
                    "humidity": 65.0,
                    "rain1h": 5.2
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "city": "Los Angeles", 
                "weather": {
                    "temp": 28.0,
                    "humidity": 45.0,
                    "rain1h": 0.0
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "city": "Miami",
                "weather": {
                    "temp": 30.0,
                    "humidity": 85.0,
                    "rain1h": 15.5
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "city": "Seattle",
                "weather": {
                    "temp": 15.0,
                    "humidity": 90.0,
                    "rain1h": 8.3
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        # Send each weather sample
        for i, weather_data in enumerate(weather_samples):
            await producer.send_and_wait("weather_stream", weather_data)
            print(f"📤 Sent weather data for {weather_data['city']}: "
                  f"temp={weather_data['weather']['temp']}°C, "
                  f"humidity={weather_data['weather']['humidity']}%, "
                  f"rain={weather_data['weather']['rain1h']}mm")
            
            # Wait between messages
            await asyncio.sleep(2)
        
        print("✅ All test weather data sent successfully!")
        
    except Exception as e:
        print(f"❌ Error sending weather data: {e}")
    finally:
        await producer.stop()
        print("✅ Kafka producer stopped")

async def main():
    """Main test function."""
    print("🌤️  Sending test weather data to Kafka...")
    await send_test_weather_data()
    print("🎉 Test completed!")

if __name__ == "__main__":
    asyncio.run(main())
