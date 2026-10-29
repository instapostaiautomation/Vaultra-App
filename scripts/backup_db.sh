#!/bin/bash
# Creates a timestamped PostgreSQL backup in /app/backups (keeps last 14).
set -e
URL=$(grep '^DATABASE_URL_SYNC=' /app/backend/.env | cut -d= -f2- | tr -d '"' | sed 's#postgresql+psycopg2://#postgresql://#')
mkdir -p /app/backups
FILE=/app/backups/vaultra_$(date +%Y%m%d_%H%M%S).sql.gz
pg_dump "$URL" | gzip > "$FILE"
ls -1t /app/backups/vaultra_*.sql.gz | tail -n +15 | xargs -r rm -f
echo "Backup saved: $FILE"
