#!/usr/bin/env bash
set -e

# Backup script for PostgreSQL and n8n data
BACKUP_DIR="/home/automaton/automaton/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
docker exec automaton_postgres pg_dump -U postgres automaton > "$BACKUP_DIR/db_$DATE.sql"

# Backup n8n workflows
tar -czf "$BACKUP_DIR/n8n_$DATE.tar.gz" -C /home/automaton/automaton/data n8n

# Cleanup backups older than 7 days
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
