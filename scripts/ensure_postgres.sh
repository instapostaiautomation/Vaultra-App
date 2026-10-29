#!/bin/bash
# Self-healing PostgreSQL for the preview pod. Data lives in /app/pgdata (persistent volume),
# so customer data survives pod restarts. Installs PostgreSQL if the pod image was reset.
set -e
BIN=/usr/lib/postgresql/15/bin
PGDATA=/app/pgdata
if [ ! -x $BIN/postgres ]; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/tmp/pg_install.log 2>&1
  pg_ctlcluster 15 main stop || true
fi
ENV=/app/backend/.env
PW=$(grep '^DATABASE_URL_SYNC=' $ENV | sed -E 's#.*postgres:([^@]*)@.*#\1#')
DB=$(grep '^DATABASE_URL_SYNC=' $ENV | sed -E 's#.*/([^/?"]*)"?$#\1#')
mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql
if [ ! -f $PGDATA/PG_VERSION ]; then
  mkdir -p $PGDATA && chown postgres:postgres $PGDATA && chmod 700 $PGDATA
  su postgres -c "$BIN/initdb -D $PGDATA -A trust -U postgres" >/tmp/pg_initdb.log 2>&1
fi
chown -R postgres:postgres $PGDATA && chmod 700 $PGDATA
OPTS="-c config_file=/etc/postgresql/15/main/postgresql.conf -c data_directory=$PGDATA"
su postgres -c "$BIN/pg_ctl -D $PGDATA -o '$OPTS' -w start" || true
su postgres -c "psql -tc \"ALTER USER postgres PASSWORD '$PW'\"" >/dev/null
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1 || su postgres -c "psql -c 'CREATE DATABASE $DB'"
su postgres -c "$BIN/pg_ctl -D $PGDATA -m fast -w stop"
exec su postgres -c "$BIN/postgres -D $PGDATA $OPTS"
