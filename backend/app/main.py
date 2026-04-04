import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import items, auth, platforms, metadata, images, permissions
import app.models.platform     # noqa: F401 — registers table with SQLAlchemy metadata
import app.models.permission   # noqa: F401

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)-8s %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Media Inventory API")
    logger.info(
        "Config: db=%s@%s:%s/%s  minio=%s  igdb=%s  tmdb=%s  omdb=%s  screenscraper=%s",
        settings.db_user,
        settings.db_host,
        settings.db_port,
        settings.db_name,
        settings.minio_endpoint,
        "configured" if settings.igdb_client_id else "NOT SET",
        "configured" if settings.tmdb_api_key else "NOT SET",
        "configured" if settings.omdb_api_key else "NOT SET",
        "configured" if settings.screenscraper_user else "NOT SET",
    )
    from app.services.storage import ensure_bucket
    await ensure_bucket()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Media Inventory API",
    version="0.1.0",
    lifespan=lifespan,
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    logger.info("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info("← %s %s %d (%.1fms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(platforms.router, prefix="/platforms", tags=["platforms"])
app.include_router(metadata.router, prefix="/metadata", tags=["metadata"])
app.include_router(images.router, prefix="/images", tags=["images"])
app.include_router(permissions.router, prefix="/permissions", tags=["permissions"])


@app.get("/health")
async def health():
    return {"status": "ok"}
