from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "media_inventory"
    db_user: str = "media_user"
    db_password: str = "changeme"

    secret_key: str = "supersecretchangeme"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week

    # MinIO
    minio_endpoint: str = "minio:9000"       # internal Docker network
    minio_public_url: str = "http://localhost:9000"  # browser-reachable
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "changeme123"
    minio_bucket: str = "media-inventory"
    minio_use_ssl: bool = False

    # Metadata API keys
    igdb_client_id: str = ""
    igdb_client_secret: str = ""
    tmdb_api_key: str = ""
    omdb_api_key: str = ""
    screenscraper_user: str = ""
    screenscraper_password: str = ""

    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:80"]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
