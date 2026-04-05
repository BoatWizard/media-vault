# Media Vault

A self-hosted media inventory system for cataloging physical games, movies, books, music, and more. Scan barcodes, search by title, upload photos, and browse your collection from any device on your network.

## Features

- **Barcode scanning** — point your camera at a UPC/EAN barcode to auto-populate metadata
- **ISBN lookup** — books are looked up via Open Library and Google Books (no API key required)
- **Title search** — search across IGDB (games), TMDB (movies/TV), OMDb, and ScreenScraper
- **Cover art** — automatically fetches and stores cover images from metadata sources
- **Photo uploads** — attach multiple photos per item; first image becomes the cover
- **Image lightbox** — tap any image to browse full-size with prev/next navigation
- **Condition & completeness tracking** — sealed, mint, CIB, loose, etc.
- **Platform filtering** — 30+ pre-loaded platforms (NES, PS2, VHS, Blu-ray, and more)
- **Multi-user** — each account has its own isolated inventory
- **Fully self-hosted** — all data stays on your server; no third-party accounts required for basic use

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Query v5 |
| Backend | FastAPI (Python), SQLAlchemy async, Alembic |
| Database | PostgreSQL 16 |
| Object storage | MinIO (S3-compatible, self-hosted) |
| Container orchestration | Docker Compose |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Clone the repository

```bash
git clone https://github.com/BoatWizard/media-vault.git
cd media-vault
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Open `.env` and at minimum set strong passwords for:
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `SECRET_KEY` — generate one with `openssl rand -hex 32`

Leave `VITE_API_URL` blank for standalone use (see [Deployment](#deployment) for reverse proxy setup).

### 3. Start the stack

```bash
docker compose up -d
```

First startup takes a minute — Postgres initializes the schema and MinIO starts up. Once running:

- **App:** http://localhost:3000
- **MinIO console:** http://localhost:9001 (use your `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)
- **API docs:** http://localhost:8000/docs

### 4. Create your account

Open http://localhost:3000 and register. The first user to register becomes the owner of their inventory.

## Metadata Sources

Media Vault chains multiple free APIs to find the best match. All are optional — the app works without any keys, though search results will be limited.

| Source | Media | Key required | Sign up |
|--------|-------|-------------|---------|
| Open Library | Books | No | — |
| Google Books | Books | No | — |
| IGDB | Games | Free (Twitch account) | [api-docs.igdb.com](https://api-docs.igdb.com/#getting-started) |
| TMDB | Movies, TV | Free | [themoviedb.org](https://developer.themoviedb.org/docs/getting-started) |
| OMDb | Movies | Free (1000 req/day) | [omdbapi.com](https://www.omdbapi.com/apikey.aspx) |
| ScreenScraper | Retro games | Free account | [screenscraper.fr](https://www.screenscraper.fr/membreinscription.php) |

Add keys to your `.env` file — sources without keys are automatically skipped.

### IGDB setup (games)

IGDB uses Twitch OAuth. After creating a free Twitch developer app at https://dev.twitch.tv/console:

```
IGDB_CLIENT_ID=your_client_id
IGDB_CLIENT_SECRET=your_client_secret
```

## Adding Items

Four methods are available from the **Add Item** page:

1. **Barcode scan** — uses your device camera to scan a UPC or EAN barcode
2. **Photo** — upload a photo of the item, then search by title
3. **Title search** — type the title and filter by media type
4. **Manual entry** — fill in all fields yourself

After a barcode scan or title search, Media Vault returns ranked candidates from all configured sources. Select the best match and confirm the pre-filled details before saving.

## Project Structure

```
media-vault/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── core/             # Config, database, auth (JWT)
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── routers/          # API endpoints (items, auth, metadata, images, platforms)
│   │   └── services/         # Business logic (metadata lookup, MinIO storage)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── components/       # Layout
│   │   ├── pages/            # InventoryPage, AddItemPage, ItemDetailPage, Auth
│   │   └── services/         # Axios API client, auth store
│   ├── Dockerfile            # Multi-stage: Vite build → nginx:alpine
│   └── nginx.conf            # SPA fallback + static asset caching
├── postgres/
│   └── init.sql              # Schema, enums, platform seed data, indexes
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## Deployment

### Standalone (localhost)

The default `docker compose up -d` runs everything on localhost. The frontend container serves the React app on port 3000 and the backend API is on port 8000. MinIO is accessible on ports 9000 (API) and 9001 (console).

### Behind a reverse proxy (recommended for public access)

If you run Media Vault behind an nginx reverse proxy (e.g., with SSL termination), two extra steps are needed:

**1. Set `VITE_API_URL=/api` in `.env` before building**

This bakes the API path into the frontend bundle at build time. The browser will send API requests to `/api/...` on the same domain, which your proxy forwards to the backend.

**2. Create a `docker-compose.override.yml`** to attach the containers to your proxy network:

```yaml
services:
  frontend:
    networks:
      - nginx_reverse_proxy
  backend:
    networks:
      - nginx_reverse_proxy

networks:
  nginx_reverse_proxy:
    external: true
```

**3. Configure your nginx proxy** for the domain:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL config here ...

    location /api/ {
        proxy_pass http://media_vault_backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location ~ ^/media-vault/ {
        # MinIO presigned URLs — proxy to MinIO so images load from your domain
        proxy_pass http://media_vault_minio:9000;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://media_vault_frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

> **Tip:** Add `resolver 127.0.0.11 valid=30s;` to your nginx server block so container name lookups refresh after restarts.

**4. Set `MINIO_PUBLIC_URL` to your public domain** so presigned image URLs are browser-reachable:

```
MINIO_PUBLIC_URL=https://your-domain.com
```

### Rebuilding after `.env` changes

`VITE_API_URL` is baked into the frontend bundle at build time. Any time you change it, rebuild the frontend container:

```bash
docker compose up -d --build frontend
```

Other backend environment variables take effect on a simple restart:

```bash
docker compose restart backend
```

## Image Storage

Images are stored in MinIO under a private bucket. The backend generates 7-day presigned URLs each time an item is fetched, so images are accessible to the browser without making the bucket public. If you restart the stack and a presigned URL expires, simply reload the item page to get a fresh one.

## License

MIT
