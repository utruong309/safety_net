#!/usr/bin/env python3
"""
Test script to publish fake SOS reports to verify real-time updates.
This script sends random SOS reports every few seconds to test the SSE streaming.
"""

import asyncio
import random
import httpx


# Sample SOS messages for testing
SOS_MESSAGES = [
    "Flooding in downtown area, water level rising rapidly!",
    "Emergency! Heavy flooding near the river, need immediate help!",
    "SOS! Water entering my house, please send help!",
    "Flood warning! Streets are completely underwater!",
    "Emergency evacuation needed! Flood waters rising fast!",
    "Help! Trapped in car due to flooding!",
    "SOS! Building flooding, need rescue immediately!",
    "Flood emergency! Water level critical!",
    "Emergency! Flood waters approaching residential area!",
    "SOS! Need immediate assistance with flooding!",
]

# Sample coordinates around New York City area
COORDINATES = [
    (40.7128, -74.0060),  # Manhattan
    (40.7589, -73.9851),  # Times Square
    (40.7505, -73.9934),  # Empire State Building
    (40.7614, -73.9776),  # Central Park
    (40.6892, -74.0445),  # Statue of Liberty
    (40.7282, -73.7949),  # Queens
    (40.6782, -73.9442),  # Brooklyn
    (40.8176, -73.9782),  # Bronx
    (40.6413, -74.0776),  # Staten Island
    (40.7505, -73.9934),  # Midtown
]

API_BASE_URL = "http://localhost:8000"


async def send_sos_report(client: httpx.AsyncClient, message: str, lat: float, lon: float) -> bool:
    """Send a single SOS report to the API."""
    try:
        data = {
            "text": message,
            "latitude": lat,
            "longitude": lon,
        }
        
        response = await client.post(
            f"{API_BASE_URL}/sos/report",
            data=data,
            timeout=10.0
        )
        response.raise_for_status()
        
        result = response.json()  # noqa: F841
        print(f"Sent SOS report: {message[:50]}... at ({lat:.4f}, {lon:.4f})")
        return True
        
    except Exception as e:
        print(f"Failed to send SOS report: {e}")
        return False


async def send_sos_with_image(client: httpx.AsyncClient, message: str, lat: float, lon: float) -> bool:
    """Send an SOS report with a fake image."""
    try:
        # Create a simple test image (1x1 pixel PNG)
        fake_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xdd\x8d\xb4\x1c\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            "file": ("test_image.png", fake_image_data, "image/png")
        }
        data = {
            "text": message,
            "latitude": lat,
            "longitude": lon,
        }
        
        response = await client.post(
            f"{API_BASE_URL}/sos/report",
            files=files,
            data=data,
            timeout=10.0
        )
        response.raise_for_status()
        
        result = response.json()  # noqa: F841
        print(f"Sent SOS report with image: {message[:50]}... at ({lat:.4f}, {lon:.4f})")
        return True
        
    except Exception as e:
        print(f"Failed to send SOS report with image: {e}")
        return False


async def main():
    """Main function to continuously send fake SOS reports."""
    print("Starting fake SOS report publisher...")
    print(f"Sending reports to: {API_BASE_URL}")
    print("Press Ctrl+C to stop")
    print("-" * 50)
    
    async with httpx.AsyncClient() as client:
        report_count = 0
        
        try:
            while True:
                # Randomly select message and coordinates
                message = random.choice(SOS_MESSAGES)
                lat, lon = random.choice(COORDINATES)
                
                # Add some random variation to coordinates
                lat += random.uniform(-0.01, 0.01)
                lon += random.uniform(-0.01, 0.01)
                
                # Randomly decide whether to include an image (30% chance)
                if random.random() < 0.3:
                    success = await send_sos_with_image(client, message, lat, lon)
                else:
                    success = await send_sos_report(client, message, lat, lon)
                
                if success:
                    report_count += 1
                    print(f"Total reports sent: {report_count}")
                
                # Wait between 2-8 seconds before sending next report
                wait_time = random.uniform(2, 8)
                print(f"Waiting {wait_time:.1f} seconds...")
                await asyncio.sleep(wait_time)
                
        except KeyboardInterrupt:
            print(f"\nStopped. Total reports sent: {report_count}")
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
