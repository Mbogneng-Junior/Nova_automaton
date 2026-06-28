-- Automaton - Schema partage pour les briques reutilisables (_shared)
-- Contient le stockage des validations humaines (Human-in-the-loop).
--
-- IMPORTANT : les scripts de ce dossier ne s'executent QUE sur une base vierge.
-- Sur la base de PROD deja en place, applique ce fichier manuellement :
--   docker exec -i automaton_postgres psql -U postgres -d automaton < services/postgres/init/03-shared-hitl.sql

CREATE SCHEMA IF NOT EXISTS shared;

-- Demandes de validation humaine envoyees sur WhatsApp.
-- tool-hitl-approval insere une ligne 'pending' + l'URL de reprise n8n.
-- tool-hitl-reply-router la retrouve quand l'humain repond, puis reprend l'execution.
CREATE TABLE IF NOT EXISTS shared.hitl_approvals (
    id          BIGSERIAL PRIMARY KEY,
    chat_id     TEXT NOT NULL,            -- destinataire WhatsApp (ex: 2376...@c.us)
    instance    TEXT DEFAULT '1',         -- instance Green API (1 = music-ai, 2 = perso)
    project_id  TEXT,
    theme       TEXT,                      -- music-ai | psychologie | ...
    step        TEXT NOT NULL,             -- concept | assets | publish | ...
    status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | revise | expired
    resume_url  TEXT NOT NULL,             -- $execution.resumeUrl du Wait node n8n
    payload     JSONB,                     -- contexte montre a l'humain
    decision    TEXT,                      -- decision normalisee
    feedback    TEXT,                      -- corrections en texte libre si 'revise'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Recherche rapide de la derniere demande en attente pour un chat donne.
CREATE INDEX IF NOT EXISTS idx_hitl_pending
    ON shared.hitl_approvals (chat_id, status, created_at DESC);
