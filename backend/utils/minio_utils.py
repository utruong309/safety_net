import os
import logging
from minio import Minio
from minio.error import S3Error
from fastapi import UploadFile, HTTPException
import asyncio
from io import BytesIO
from uuid import uuid4
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class MinIOClient:
    """MinIO client wrapper for async operations."""
    
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000").replace("http://", "").replace("https://", "")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "minio")
        self.secret_key = os.getenv("MINIO_SECRET_KEY", "minio123")
        self.bucket = os.getenv("MINIO_BUCKET", "sos-media")
        self.secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
        self.base_url = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
        
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure
        )
    
    def ensure_bucket_exists(self) -> None:
        """Ensure the bucket exists, create if it doesn't."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created MinIO bucket: {self.bucket}")
            else:
                logger.info(f"MinIO bucket exists: {self.bucket}")
        except S3Error as e:
            logger.error(f"Failed to create bucket {self.bucket}: {e}")
            raise
    
    async def upload_file(self, file: UploadFile) -> str:
        """Upload file to MinIO and return public URL."""
        if file is None:
            return ""
        
        file_bytes = await file.read()
        if not file_bytes:
            return ""
        
        content_type = file.content_type or "application/octet-stream"
        
        # Generate unique object name with timestamp and UUID
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        file_extension = ""
        if file.filename and "." in file.filename:
            file_extension = f".{file.filename.split('.')[-1]}"
        
        object_name = f"sos/{timestamp}_{uuid4().hex}{file_extension}"
        
        def _put_object():
            bio = BytesIO(file_bytes)
            self.client.put_object(
                self.bucket,
                object_name,
                data=bio,
                length=len(file_bytes),
                content_type=content_type
            )
        
        try:
            # Run synchronous MinIO operation in thread pool
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _put_object)
            
            # Return public URL
            url = f"{self.base_url}/{self.bucket}/{object_name}"
            logger.info(f"File uploaded to MinIO: {url}")
            return url
            
        except S3Error as e:
            logger.error(f"MinIO upload failed: {e}")
            raise HTTPException(status_code=500, detail=f"File upload failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during upload: {e}")
            raise HTTPException(status_code=500, detail=f"Upload error: {e}")

# Global MinIO client instance
minio_client = MinIOClient()