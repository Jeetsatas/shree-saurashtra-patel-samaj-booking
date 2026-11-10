#!/bin/bash
# =============================================================================
# Shree Saurashtra Patel Samaj, Nikol–Naroda
# Automated Database Backup Script (PostgreSQL / SQLite)
# Retention Policy: 30 days
# =============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30

echo "---------------------------------------------------------"
echo "Starting Database Backup for Patel Samaj Booking System"
echo "Timestamp: $TIMESTAMP"
echo "---------------------------------------------------------"

if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
  BACKUP_FILE="$BACKUP_DIR/patel_samaj_pg_${TIMESTAMP}.sql.gz"
  echo "Target: PostgreSQL Database ($DATABASE_URL)"

  pg_dump "$DATABASE_URL" --no-owner --clean --if-exists | gzip > "$BACKUP_FILE"

  echo "Verifying backup integrity..."
  gzip -t "$BACKUP_FILE"

  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ PostgreSQL Backup successful: $BACKUP_FILE ($FILE_SIZE)"

elif [ -f "./prisma/dev.db" ]; then
  BACKUP_FILE="$BACKUP_DIR/patel_samaj_sqlite_${TIMESTAMP}.db.gz"
  echo "Target: SQLite Database (./prisma/dev.db)"

  sqlite3 ./prisma/dev.db ".backup './prisma/dev.db.bak'"
  gzip -c "./prisma/dev.db.bak" > "$BACKUP_FILE"
  rm -f "./prisma/dev.db.bak"

  echo "Verifying backup integrity..."
  gzip -t "$BACKUP_FILE"

  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ SQLite Backup successful: $BACKUP_FILE ($FILE_SIZE)"

else
  echo "❌ Error: Neither PostgreSQL DATABASE_URL nor ./prisma/dev.db was found!"
  exit 1
fi

# Retention Cleanup: remove backups older than 30 days
echo "Applying retention policy ($RETENTION_DAYS days)..."
find "$BACKUP_DIR" -type f -name "patel_samaj_*" -mtime +"$RETENTION_DAYS" -exec rm -f {} \;
echo "✅ Retention cleanup complete."
echo "Backup process finished successfully."

