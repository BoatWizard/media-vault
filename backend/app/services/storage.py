import logging
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import uuid
import mimetypes
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Internal client using Docker-network endpoint — for uploads only."""
    endpoint = f"http{'s' if settings.minio_use_ssl else ''}://{settings.minio_endpoint}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _get_public_client():
    """Public client using the browser-reachable endpoint — for presigned URLs."""
    return boto3.client(
        "s3",
        endpoint_url=settings.minio_public_url,
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


async def ensure_bucket():
    logger.info("MinIO: checking bucket=%r at %s", settings.minio_bucket, settings.minio_endpoint)
    client = _get_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
        logger.info("MinIO: bucket=%r already exists", settings.minio_bucket)
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        logger.info("MinIO: bucket=%r not found (%s), creating", settings.minio_bucket, error_code)
        client.create_bucket(Bucket=settings.minio_bucket)

    # Always enforce private — remove any existing public-read policy
    try:
        client.delete_bucket_policy(Bucket=settings.minio_bucket)
        logger.info("MinIO: removed public policy from bucket=%r (access via presigned URLs only)", settings.minio_bucket)
    except ClientError:
        pass  # No policy to remove — already private


def get_presigned_url(key: Optional[str], expires: int = 604800) -> Optional[str]:
    """
    Return a presigned GET URL valid for `expires` seconds (default 7 days).
    Uses the public MinIO URL so the link works from the browser.
    Returns None for empty/None keys.
    """
    if not key:
        return None
    try:
        url = _get_public_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.minio_bucket, "Key": key},
            ExpiresIn=expires,
        )
        logger.debug("MinIO: presigned URL generated for key=%r (expires=%ds)", key, expires)
        return url
    except Exception as exc:
        logger.error("MinIO: presigned URL failed for key=%r: %s", key, exc)
        return None


async def upload_image(image_bytes: bytes, content_type: str, user_id: str) -> str:
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"
    key = f"images/{user_id}/{uuid.uuid4()}{ext}"
    logger.info("MinIO: uploading %d bytes content_type=%r key=%r", len(image_bytes), content_type, key)

    client = _get_client()
    try:
        client.put_object(
            Bucket=settings.minio_bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
        )
        logger.info("MinIO: upload succeeded key=%r", key)
    except Exception as exc:
        logger.error("MinIO: upload failed key=%r: %s", key, exc)
        raise
    return key
