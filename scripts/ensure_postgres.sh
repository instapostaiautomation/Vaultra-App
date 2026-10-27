#!/bin/bash
# Self-healing PostgreSQL for the preview pod: installs PostgreSQL if the pod was reset, then runs it.
set -e
if [ ! -x /usr/lib/postgresql/15/bin/postgres ]; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/tmp/pg_install.log 2>&1
  pg_ctlcluster 15 main stop || true
fi
ENV=/app/backend/.env
PW=$(grep '^DATABASE_URL_SYNC=' $ENV | sed -E 's#.*postgres:([^@]*)@.*#\1#')
DB=$(grep '^DATABASE_URL_SYNC=' $ENV | sed -E 's#.*/([^/?"]*)"?$#\1#')
mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql
su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/15/main -o '-c config_file=/etc/postgresql/15/main/postgresql.conf' -w start" || true
su postgres -c "psql -tc \"ALTER USER postgres PASSWORD '$PW'\"" >/dev/null
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1 || su postgres -c "psql -c 'CREATE DATABASE $DB'"
su postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/15/main -m fast -w stop"
exec su postgres -c "/usr/lib/postgresql/15/bin/postgres -D /var/lib/postgresql/15/main -c config_file=/etc/postgresql/15/main/postgresql.conf"
