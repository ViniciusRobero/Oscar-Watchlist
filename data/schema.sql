-- data/schema.sql
-- Schema for Oscar Watchlist Database (Turso/SQLite)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_film_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    film_id TEXT NOT NULL,
    edition_id TEXT NOT NULL,
    watched BOOLEAN DEFAULT 0,
    personal_rating INTEGER CHECK(personal_rating >= 0 AND personal_rating <= 10),
    personal_notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, film_id, edition_id)
);

CREATE TABLE IF NOT EXISTS user_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    edition_id TEXT NOT NULL,
    nominee_id TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, category_id, edition_id)
);

CREATE TABLE IF NOT EXISTS official_results (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    edition_id TEXT NOT NULL,
    winner_nominee_id TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, edition_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
