-- Automaton - Stockage des métriques collectées par le worker analytics (queue:analytics).
-- Une ligne par vidéo, mise à jour à chaque collecte.
--
-- Sur la base PROD déjà en place, appliquer manuellement :
--   docker exec -i automaton_postgres psql -U postgres -d automaton \
--     < services/postgres/init/05-shared-analytics.sql

CREATE SCHEMA IF NOT EXISTS shared;

CREATE TABLE IF NOT EXISTS shared.video_analytics (
    id              BIGSERIAL PRIMARY KEY,
    video_id        TEXT NOT NULL UNIQUE,     -- identifiant YouTube (ou autre plateforme)
    project_id      TEXT,
    profil          TEXT,                     -- actu-ia | dark-psychology | documentaire | sport
    platform        TEXT NOT NULL DEFAULT 'youtube',
    views           BIGINT NOT NULL DEFAULT 0,
    likes           BIGINT NOT NULL DEFAULT 0,
    comments        BIGINT NOT NULL DEFAULT 0,
    favorites       BIGINT NOT NULL DEFAULT 0,
    avg_view_duration_sec REAL,               -- durée moyenne de visionnage (YouTube Analytics)
    avg_view_percentage   REAL,               -- % moyen visionné
    analytics_raw   JSONB,                    -- réponse brute de l'API analytics
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ               -- date de publication originale si connue
);

CREATE INDEX IF NOT EXISTS idx_video_analytics_profil
    ON shared.video_analytics (profil, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_analytics_project
    ON shared.video_analytics (project_id);
