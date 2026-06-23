-- Create n8n database and user
-- IMPORTANT: replace 'change_me_n8n_db_password' with the value of N8N_DB_PASSWORD from .env
-- before the first PostgreSQL container start.

CREATE USER n8n WITH PASSWORD 'change_me_n8n_db_password';
CREATE DATABASE n8n OWNER n8n;
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n;
