-- Automaton - Schema partage pour les briques reutilisables (_shared)
-- Suivi de la matiere premiere (veille) et des themes deja traites par profil.
--
-- IMPORTANT : les scripts de ce dossier ne s'executent QUE sur une base vierge.
-- Sur la base de PROD deja en place, applique ce fichier manuellement :
--   docker exec -i automaton_postgres psql -U postgres -d automaton < services/postgres/init/04-shared-content-tracking.sql

CREATE SCHEMA IF NOT EXISTS shared;

-- Matiere premiere collectee par l'Agent Veille.
-- Chaque ligne est un item brut (article, post, resultat sportif, citation, etc.)
-- qui sera plus tard score, deduplique et transforme en sujet par l'Agent Analyse.
CREATE TABLE IF NOT EXISTS shared.raw_items (
    id          BIGSERIAL PRIMARY KEY,
    profil      TEXT NOT NULL,             -- actu-ia | dark-psychology | documentaire | sport
    source      TEXT NOT NULL,             -- nom de la source (rss, api, site, fichier...)
    source_url  TEXT,                      -- URL originale de l'item
    external_id TEXT,                      -- identifiant externe si disponible
    title       TEXT,
    summary     TEXT,
    content     TEXT,
    language    TEXT DEFAULT 'fr',
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,              -- date de publication originale
    metadata    JSONB DEFAULT '{}',        -- champs specifiques a la source (scores bruts, auteur, etc.)
    status      TEXT NOT NULL DEFAULT 'pending', -- pending | scored | selected | rejected | used
    score       REAL,                      -- score heuristique / LLM
    selected_at TIMESTAMPTZ,
    project_id  TEXT                       -- lie au projet final si l'item est retenu
);

-- Eviter de collecter deux fois le meme item pour le meme profil.
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_items_unique
    ON shared.raw_items (profil, source, COALESCE(external_id, source_url));

-- Recherche rapide des items en attente de scoring.
CREATE INDEX IF NOT EXISTS idx_raw_items_pending
    ON shared.raw_items (profil, status, collected_at DESC);

-- Themes / sujets deja traites par profil.
-- Utilise principalement par les profils a cadence lente (Dark Psychology, Documentaire)
-- pour eviter les repetitions et tracer le fil narratif.
CREATE TABLE IF NOT EXISTS shared.themes_traites (
    id          BIGSERIAL PRIMARY KEY,
    profil      TEXT NOT NULL,
    theme       TEXT NOT NULL,             -- theme normalise (ex: "manipulation", "stoicisme")
    label       TEXT,                      -- libelle lisible
    project_id  TEXT,                    -- projet qui a traite ce theme
    first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    use_count   INTEGER NOT NULL DEFAULT 1,
    metadata    JSONB DEFAULT '{}'         -- tags, niveaux, citations associees...
);

-- Un theme n'est compte qu'une fois par profil (le use_count est incremente).
CREATE UNIQUE INDEX IF NOT EXISTS idx_themes_traites_unique
    ON shared.themes_traites (profil, theme);

-- Recherche rapide par profil.
CREATE INDEX IF NOT EXISTS idx_themes_traites_profil
    ON shared.themes_traites (profil, last_used_at DESC);

