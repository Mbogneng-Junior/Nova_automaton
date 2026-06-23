-- Automaton - PostgreSQL multi-schema setup
-- One schema per workflow, shared database, shared Redis/n8n

-- Core schemas
CREATE SCHEMA IF NOT EXISTS music_ai;
CREATE SCHEMA IF NOT EXISTS workflow_template;

-- Common analytics table in each schema
DO $$
DECLARE
    schema_name text;
BEGIN
    FOREACH schema_name IN ARRAY ARRAY['music_ai', 'workflow_template']
    LOOP
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.analytics_events (
            id SERIAL PRIMARY KEY,
            project_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', schema_name);
    END LOOP;
END $$;
