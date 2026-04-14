"""
MetadataService: chains IGDB, TMDB, OMDb, ScreenScraper, UPCitemdb, Open Library,
and Google Books to return ranked metadata candidates for a given barcode, ISBN, or title.
"""
import logging
import re
import httpx
from datetime import datetime
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

# Formats returned by various APIs that we try to parse into YYYY-MM-DD
_DATE_FORMATS = [
    "%Y-%m-%d",      # ISO — already correct
    "%d %b %Y",      # OMDb: "15 Jan 2021"
    "%B %d, %Y",     # Google Books: "January 15, 2021"
    "%Y-%m",         # year-month only
    "%Y",            # year only
]

def _parse_date(value) -> Optional[str]:
    """Coerce any date-like string to YYYY-MM-DD, or return None."""
    if not value:
        return None
    if isinstance(value, str):
        value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(str(value), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Last resort: grab a 4-digit year
    m = re.search(r'\b(\d{4})\b', str(value))
    if m:
        return f"{m.group(1)}-01-01"
    return None


def _normalize(**kwargs) -> dict:
    """Return a metadata result dict with all expected keys."""
    return {
        "title": kwargs.get("title", "Unknown"),
        "media_type": kwargs.get("media_type"),
        "platform": kwargs.get("platform"),
        "release_date": _parse_date(kwargs.get("release_date")),
        "description": kwargs.get("description"),
        "developer": kwargs.get("developer"),
        "publisher": kwargs.get("publisher"),
        "genre": kwargs.get("genre") or [],
        "region": kwargs.get("region"),
        "cover_art_url": kwargs.get("cover_art_url"),
        "igdb_id": kwargs.get("igdb_id"),
        "tmdb_id": kwargs.get("tmdb_id"),
        "screenscraper_id": kwargs.get("screenscraper_id"),
        "sources": kwargs.get("sources") or [],
        "confidence": kwargs.get("confidence", 0.5),
    }


# ── IGDB ─────────────────────────────────────────────────────────────────────

_igdb_token_cache: dict = {}


async def _igdb_token() -> Optional[str]:
    if not settings.igdb_client_id:
        logger.debug("IGDB: skipping — igdb_client_id not configured")
        return None
    if _igdb_token_cache.get("token"):
        logger.debug("IGDB: using cached token")
        return _igdb_token_cache["token"]
    logger.debug("IGDB: fetching new OAuth token")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": settings.igdb_client_id,
                "client_secret": settings.igdb_client_secret,
                "grant_type": "client_credentials",
            },
        )
        logger.debug("IGDB token response: HTTP %d", r.status_code)
        if r.status_code == 200:
            _igdb_token_cache["token"] = r.json()["access_token"]
            return _igdb_token_cache["token"]
        logger.warning("IGDB: token request failed: HTTP %d body=%s", r.status_code, r.text[:200])
    return None


async def _igdb_search(title: str, platform: Optional[str] = None) -> list[dict]:
    token = await _igdb_token()
    if not token:
        return []
    query = (
        f'search "{title}"; '
        'fields name,summary,first_release_date,cover.url,genres.name,'
        'involved_companies.company.name,platforms.name; limit 5;'
    )
    logger.info("IGDB: searching for title=%r platform=%r", title, platform)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.igdb.com/v4/games",
            headers={
                "Client-ID": settings.igdb_client_id,
                "Authorization": f"Bearer {token}",
            },
            content=query,
        )
        logger.debug("IGDB search response: HTTP %d body=%s", r.status_code, r.text[:500])
        if r.status_code != 200:
            logger.warning("IGDB: search failed: HTTP %d body=%s", r.status_code, r.text[:200])
            return []
    results = []
    for g in r.json():
        companies = [ic.get("company", {}).get("name") for ic in g.get("involved_companies", [])]
        cover = g.get("cover", {}).get("url", "")
        if cover.startswith("//"):
            cover = "https:" + cover.replace("t_thumb", "t_cover_big")
        ts = g.get("first_release_date")
        release = None
        if ts:
            from datetime import datetime
            release = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        results.append(_normalize(
            title=g.get("name"),
            media_type="game",
            release_date=release,
            description=g.get("summary"),
            cover_art_url=cover or None,
            genre=[gn.get("name") for gn in g.get("genres", [])],
            developer=companies[0] if companies else None,
            igdb_id=g.get("id"),
            sources=["igdb"],
            confidence=0.8,
        ))
    logger.info("IGDB: got %d results for %r", len(results), title)
    return results


# ── TMDB ─────────────────────────────────────────────────────────────────────

async def _tmdb_search(title: str, media_type: Optional[str] = None) -> list[dict]:
    if not settings.tmdb_api_key:
        logger.debug("TMDB: skipping — tmdb_api_key not configured")
        return []
    endpoint = "tv" if media_type == "tv_show" else "movie"
    logger.info("TMDB: searching %s for title=%r", endpoint, title)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"https://api.themoviedb.org/3/search/{endpoint}",
            params={"api_key": settings.tmdb_api_key, "query": title},
        )
        logger.debug("TMDB response: HTTP %d body=%s", r.status_code, r.text[:500])
        if r.status_code != 200:
            logger.warning("TMDB: search failed: HTTP %d body=%s", r.status_code, r.text[:200])
            return []
    results = []
    for m in r.json().get("results", [])[:5]:
        poster = m.get("poster_path")
        results.append(_normalize(
            title=m.get("title") or m.get("name"),
            media_type=media_type or "movie",
            release_date=m.get("release_date") or m.get("first_air_date"),
            description=m.get("overview"),
            cover_art_url=f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
            tmdb_id=m.get("id"),
            sources=["tmdb"],
            confidence=0.75,
        ))
    logger.info("TMDB: got %d results for %r", len(results), title)
    return results


# ── OMDb ─────────────────────────────────────────────────────────────────────

async def _omdb_search(title: str) -> list[dict]:
    if not settings.omdb_api_key:
        logger.debug("OMDb: skipping — omdb_api_key not configured")
        return []
    logger.info("OMDb: searching for title=%r", title)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "http://www.omdbapi.com/",
            params={"apikey": settings.omdb_api_key, "t": title},
        )
        logger.debug("OMDb response: HTTP %d body=%s", r.status_code, r.text[:500])
        if r.status_code != 200:
            logger.warning("OMDb: request failed: HTTP %d body=%s", r.status_code, r.text[:200])
            return []
    data = r.json()
    if data.get("Response") != "True":
        logger.info("OMDb: no match found (Response=%s, Error=%s)", data.get("Response"), data.get("Error"))
        return []
    poster = data.get("Poster")
    result = [_normalize(
        title=data.get("Title"),
        media_type="movie",
        release_date=data.get("Released"),
        description=data.get("Plot"),
        cover_art_url=poster if poster and poster != "N/A" else None,
        genre=[g.strip() for g in data.get("Genre", "").split(",") if g.strip()],
        sources=["omdb"],
        confidence=0.7,
    )]
    logger.info("OMDb: got 1 result for %r: %r", title, data.get("Title"))
    return result


# ── UPCitemdb ─────────────────────────────────────────────────────────────────

async def _upc_lookup(upc: str) -> Optional[dict]:
    logger.info("UPCitemdb: looking up UPC=%r", upc)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.upcitemdb.com/prod/trial/lookup",
            params={"upc": upc},
        )
        logger.debug("UPCitemdb response: HTTP %d body=%s", r.status_code, r.text[:500])
        if r.status_code != 200:
            logger.warning("UPCitemdb: lookup failed: HTTP %d body=%s", r.status_code, r.text[:200])
            return None
    items = r.json().get("items", [])
    if not items:
        logger.info("UPCitemdb: no items found for UPC=%r", upc)
        return None
    item = items[0]
    cat = (item.get("category") or "").lower()
    title_lower = (item.get("title") or "").lower()
    media_type = "game" if "game" in cat else ("movie" if any(k in cat for k in ["dvd", "blu", "movie"]) else None)
    logger.info("UPCitemdb: found title=%r category=%r inferred media_type=%r", item.get("title"), cat, media_type)
    return {"title": item.get("title"), "media_type": media_type}


# ── Open Library (ISBN) ───────────────────────────────────────────────────────

async def _open_library_isbn_lookup(isbn: str) -> Optional[dict]:
    """Look up a book by ISBN using the Open Library API (free, no key required)."""
    logger.info("OpenLibrary: looking up ISBN=%r", isbn)
    description = None
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://openlibrary.org/api/books",
            params={"bibkeys": f"ISBN:{isbn}", "format": "json", "jscmd": "data"},
        )
        logger.debug("OpenLibrary response: HTTP %d body=%s", r.status_code, r.text[:500])
        if r.status_code != 200:
            logger.warning("OpenLibrary: request failed: HTTP %d", r.status_code)
            return None
        data = r.json().get(f"ISBN:{isbn}")
        if not data:
            logger.info("OpenLibrary: no match for ISBN=%r", isbn)
            return None

        # Description lives on the Work record — fetch via edition → work
        book_key = data.get("key")  # e.g. "/books/OL61355083M"
        if book_key:
            try:
                edition_r = await client.get(f"https://openlibrary.org{book_key}.json")
                if edition_r.status_code == 200:
                    works = edition_r.json().get("works", [])
                    if works:
                        work_key = works[0].get("key")  # e.g. "/works/OL3335245W"
                        work_r = await client.get(f"https://openlibrary.org{work_key}.json")
                        if work_r.status_code == 200:
                            desc = work_r.json().get("description")
                            if isinstance(desc, dict):
                                description = desc.get("value")
                            elif isinstance(desc, str):
                                description = desc
            except Exception as exc:
                logger.debug("OpenLibrary: could not fetch description: %s", exc)

    # Deduplicate authors (translated editions repeat the same author multiple times)
    seen: set = set()
    unique_authors = []
    for a in data.get("authors", []):
        name = a.get("name", "")
        if name and name not in seen:
            seen.add(name)
            unique_authors.append(name)

    publishers = [p.get("name") for p in data.get("publishers", [])]
    subjects = [s.get("name") for s in data.get("subjects", [])]
    cover = data.get("cover", {}).get("large") or data.get("cover", {}).get("medium")

    logger.info("OpenLibrary: found title=%r authors=%r publisher=%r", data.get("title"), unique_authors, publishers[:1])
    return _normalize(
        title=data.get("title"),
        media_type="book",
        release_date=data.get("publish_date"),
        developer=", ".join(unique_authors[:3]) if unique_authors else None,
        publisher=publishers[0] if publishers else None,
        genre=subjects[:5],
        cover_art_url=cover,
        description=description,
        sources=["openlibrary"],
        confidence=0.85,
    )


# ── Google Books (ISBN fallback) ──────────────────────────────────────────────

def _google_books_parse(info: dict, source_label: str, confidence: float) -> dict:
    """Convert a Google Books volumeInfo dict to a normalized result."""
    cover = (info.get("imageLinks") or {}).get("thumbnail") or (info.get("imageLinks") or {}).get("smallThumbnail")
    if cover:
        cover = cover.replace("http://", "https://")
    return _normalize(
        title=info.get("title"),
        media_type="book",
        release_date=info.get("publishedDate"),
        developer=", ".join(info.get("authors", [])) or None,
        publisher=info.get("publisher"),
        genre=info.get("categories", []),
        cover_art_url=cover,
        description=info.get("description"),
        sources=[source_label],
        confidence=confidence,
    )


async def _google_books_isbn_lookup(isbn: str) -> Optional[dict]:
    """Look up a book by ISBN using Google Books API (free, no key required)."""
    logger.info("GoogleBooks: looking up ISBN=%r", isbn)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={"q": f"isbn:{isbn}"},
        )
        logger.debug("GoogleBooks response: HTTP %d body=%s", r.status_code, r.text[:300])
        if r.status_code != 200:
            logger.warning("GoogleBooks: request failed: HTTP %d", r.status_code)
            return None
    items = r.json().get("items", [])
    if not items:
        logger.info("GoogleBooks: no results for ISBN=%r", isbn)
        return None
    info = items[0].get("volumeInfo", {})
    logger.info("GoogleBooks: found title=%r authors=%r publisher=%r", info.get("title"), info.get("authors"), info.get("publisher"))
    return _google_books_parse(info, "googlebooks", 0.82)


async def _google_books_title_search(title: str) -> list[dict]:
    """Search Google Books by title (free, no key required). Returns up to 5 results."""
    logger.info("GoogleBooks: title search for %r", title)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://www.googleapis.com/books/v1/volumes",
            params={"q": f"intitle:{title}", "maxResults": 5, "printType": "books"},
        )
        logger.debug("GoogleBooks title search response: HTTP %d body=%s", r.status_code, r.text[:300])
        if r.status_code != 200:
            logger.warning("GoogleBooks: title search failed: HTTP %d", r.status_code)
            return []
    items = r.json().get("items", [])
    if not items:
        logger.info("GoogleBooks: no title results for %r", title)
        return []
    results = [_google_books_parse(item.get("volumeInfo", {}), "googlebooks", 0.75) for item in items]
    logger.info("GoogleBooks: got %d title results for %r", len(results), title)
    return results


async def _open_library_title_search(title: str) -> list[dict]:
    """Search Open Library by title (free, no key required). Returns up to 5 results."""
    logger.info("OpenLibrary: title search for %r", title)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://openlibrary.org/search.json",
            params={"title": title, "limit": 5, "fields": "key,title,author_name,publisher,first_publish_year,cover_i,subject"},
        )
        logger.debug("OpenLibrary title search response: HTTP %d body=%s", r.status_code, r.text[:300])
        if r.status_code != 200:
            logger.warning("OpenLibrary: title search failed: HTTP %d", r.status_code)
            return []
    docs = r.json().get("docs", [])
    results = []
    for doc in docs:
        cover_i = doc.get("cover_i")
        cover = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg" if cover_i else None
        authors = doc.get("author_name") or []
        publishers = doc.get("publisher") or []
        subjects = doc.get("subject") or []
        year = doc.get("first_publish_year")
        results.append(_normalize(
            title=doc.get("title"),
            media_type="book",
            release_date=str(year) if year else None,
            developer=", ".join(authors[:3]) if authors else None,
            publisher=publishers[0] if publishers else None,
            genre=subjects[:5],
            cover_art_url=cover,
            sources=["openlibrary"],
            confidence=0.72,
        ))
    logger.info("OpenLibrary: got %d title results for %r", len(results), title)
    return results


# ── ScreenScraper ─────────────────────────────────────────────────────────────

async def _screenscraper_search(title: str, platform: Optional[str] = None) -> list[dict]:
    if not settings.screenscraper_user:
        logger.debug("ScreenScraper: skipping — screenscraper_user not configured")
        return []
    logger.info("ScreenScraper: searching for title=%r platform=%r", title, platform)
    params = {
        "devid": "media_inventory",
        "devpassword": "",
        "softname": "media_inventory",
        "output": "json",
        "ssid": settings.screenscraper_user,
        "sspassword": settings.screenscraper_password,
        "romtype": "rom",
        "romnom": title,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://www.screenscraper.fr/api2/jeuInfos.php", params=params)
        logger.debug("ScreenScraper response: HTTP %d body=%s", r.status_code, r.text[:500])
        if r.status_code != 200:
            logger.warning("ScreenScraper: request failed: HTTP %d body=%s", r.status_code, r.text[:200])
            return []
    try:
        game = r.json().get("response", {}).get("jeu", {})
    except Exception as exc:
        logger.warning("ScreenScraper: failed to parse JSON: %s", exc)
        return []
    if not game:
        logger.info("ScreenScraper: no game found for title=%r", title)
        return []

    names = game.get("noms", [])
    name = next((n.get("text") for n in names if n.get("region") == "us"), None)
    if not name and names:
        name = names[0].get("text")

    medias = game.get("medias", [])
    cover = next((m.get("url") for m in medias if m.get("type") == "box-2D"), None)
    synopses = game.get("synopsis", [])
    desc = synopses[0].get("text") if synopses else None
    dates = game.get("dates", [])
    release = dates[0].get("text") if dates else None

    result = [_normalize(
        title=name,
        media_type="game",
        release_date=release,
        description=desc,
        cover_art_url=cover,
        developer=game.get("developpeur", {}).get("text"),
        publisher=game.get("editeur", {}).get("text"),
        screenscraper_id=game.get("id"),
        sources=["screenscraper"],
        confidence=0.8,
    )]
    logger.info("ScreenScraper: found title=%r id=%r", name, game.get("id"))
    return result


# ── MetadataService ───────────────────────────────────────────────────────────

class MetadataService:
    async def lookup_by_upc(self, upc: str) -> list[dict]:
        logger.info("MetadataService.lookup_by_upc: upc=%r", upc)

        # ISBN barcodes start with 978 or 979 — try book sources first (free, no key)
        if upc.startswith(("978", "979")):
            result = await _open_library_isbn_lookup(upc)
            if not result:
                result = await _google_books_isbn_lookup(upc)
            if result:
                return [result]

        upc_data = await _upc_lookup(upc)
        title = upc_data.get("title") if upc_data else None
        media_type = upc_data.get("media_type") if upc_data else None
        if not title:
            logger.info("MetadataService.lookup_by_upc: no title from UPC lookup, returning empty")
            return []
        results = await self.search_by_title(title, media_type=media_type)
        if not results:
            # API keys may not be configured — return the raw UPCitemdb data so the
            # user at least gets a pre-filled title/media_type to confirm.
            logger.info("MetadataService.lookup_by_upc: no enriched results, falling back to UPCitemdb data")
            results = [_normalize(title=title, media_type=media_type, sources=["upcitemdb"], confidence=0.4)]
        return results

    async def search_by_title(
        self,
        title: str,
        media_type: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> list[dict]:
        logger.info("MetadataService.search_by_title: title=%r media_type=%r platform=%r", title, media_type, platform)
        results: list[dict] = []

        if media_type in (None, "game"):
            results += await _igdb_search(title, platform)
            results += await _screenscraper_search(title, platform)

        if media_type in (None, "movie", "tv_show"):
            results += await _tmdb_search(title, media_type)
            results += await _omdb_search(title)

        if media_type in (None, "book"):
            results += await _google_books_title_search(title)
            results += await _open_library_title_search(title)

        # Deduplicate by (title, year) — same title in different years are distinct releases
        seen: dict[tuple, dict] = {}
        for r in results:
            ym = re.search(r'\d{4}', r.get("release_date") or "")
            year = ym.group(0) if ym else ""
            key = ((r["title"] or "").lower(), year)
            if key not in seen or r["confidence"] > seen[key]["confidence"]:
                seen[key] = r

        ranked = sorted(seen.values(), key=lambda x: -x["confidence"])
        logger.info("MetadataService.search_by_title: returning %d deduplicated results", len(ranked))
        return ranked

