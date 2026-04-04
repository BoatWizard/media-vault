-- Media Inventory Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- enables fast fuzzy text search

-- Enum types
CREATE TYPE media_type AS ENUM (
    'game', 'movie', 'tv_show', 'music', 'book', 'other'
);

CREATE TYPE condition_type AS ENUM (
    'sealed', 'mint', 'very_good', 'good', 'fair', 'poor'
);

CREATE TYPE completeness_type AS ENUM (
    'sealed', 'complete_in_box', 'game_only', 'box_only', 'loose', 'other'
);

-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(50) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Platforms (NES, SNES, VHS, DVD, etc.)
CREATE TABLE platforms (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    short_name  VARCHAR(20),
    media_type  media_type NOT NULL,
    sort_order  INT DEFAULT 0
);

INSERT INTO platforms (name, short_name, media_type, sort_order) VALUES
    ('Nintendo Entertainment System', 'NES', 'game', 10),
    ('Super Nintendo', 'SNES', 'game', 20),
    ('Nintendo 64', 'N64', 'game', 30),
    ('GameCube', 'GCN', 'game', 40),
    ('Wii', 'Wii', 'game', 50),
    ('Wii U', 'WiiU', 'game', 55),
    ('Nintendo Switch', 'Switch', 'game', 60),
    ('Game Boy', 'GB', 'game', 70),
    ('Game Boy Color', 'GBC', 'game', 75),
    ('Game Boy Advance', 'GBA', 'game', 80),
    ('Nintendo DS', 'NDS', 'game', 85),
    ('Nintendo 3DS', '3DS', 'game', 87),
    ('Sega Genesis', 'Genesis', 'game', 110),
    ('Sega Saturn', 'Saturn', 'game', 120),
    ('Sega Dreamcast', 'DC', 'game', 130),
    ('Sega Game Gear', 'GG', 'game', 135),
    ('PlayStation', 'PS1', 'game', 210),
    ('PlayStation 2', 'PS2', 'game', 220),
    ('PlayStation 3', 'PS3', 'game', 230),
    ('PlayStation 4', 'PS4', 'game', 240),
    ('PlayStation 5', 'PS5', 'game', 250),
    ('PlayStation Portable', 'PSP', 'game', 260),
    ('PlayStation Vita', 'Vita', 'game', 265),
    ('Xbox', 'Xbox', 'game', 310),
    ('Xbox 360', 'X360', 'game', 320),
    ('Xbox One', 'XOne', 'game', 330),
    ('PC', 'PC', 'game', 400),
    ('Atari 2600', '2600', 'game', 510),
    ('Atari 7800', '7800', 'game', 515),
    ('TurboGrafx-16', 'TG16', 'game', 520),
    ('Neo Geo', 'NG', 'game', 530),
    ('VHS', 'VHS', 'movie', 610),
    ('DVD', 'DVD', 'movie', 620),
    ('Blu-ray', 'BD', 'movie', 630),
    ('4K Blu-ray', '4K', 'movie', 640),
    ('LaserDisc', 'LD', 'movie', 650),
    ('Beta', 'Beta', 'movie', 660),
    ('Other', 'Other', 'other', 999);

-- Main items table
CREATE TABLE items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_id     INT REFERENCES platforms(id),

    -- Core metadata
    title           VARCHAR(500) NOT NULL,
    media_type      media_type NOT NULL,
    release_date    DATE,
    description     TEXT,
    region          VARCHAR(20),   -- NTSC-U, PAL, NTSC-J, etc.
    serial_number   VARCHAR(100),
    upc             VARCHAR(50),
    genre           TEXT[],
    developer       VARCHAR(255),
    publisher       VARCHAR(255),
    rating          VARCHAR(20),   -- ESRB/MPAA rating

    -- Physical condition
    condition       condition_type,
    completeness    completeness_type,
    notes           TEXT,

    -- Images (stored in MinIO, referenced by key)
    cover_image_key VARCHAR(500),
    extra_image_keys TEXT[],

    -- Enrichment metadata
    igdb_id         INT,
    tmdb_id         INT,
    screenscraper_id INT,
    enrichment_sources TEXT[],
    user_confirmed  BOOLEAN DEFAULT false,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Full text search index on title + description
CREATE INDEX idx_items_title_trgm ON items USING gin (title gin_trgm_ops);
CREATE INDEX idx_items_media_type ON items (media_type);
CREATE INDEX idx_items_platform ON items (platform_id);
CREATE INDEX idx_items_owner ON items (owner_id);
CREATE INDEX idx_items_upc ON items (upc);
CREATE INDEX idx_items_created ON items (created_at DESC);

-- Tags (cross-cutting labels: "graded", "sealed", "signed", etc.)
CREATE TABLE tags (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE item_tags (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    tag_id  INT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- Audit log for bulk ingestion sessions
CREATE TABLE ingestion_sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    started_at  TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    item_count  INT DEFAULT 0,
    notes       TEXT
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
