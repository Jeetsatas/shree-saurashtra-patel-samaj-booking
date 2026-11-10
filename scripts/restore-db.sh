#!/bin/bash
# =============================================================================
# Shree Saurashtra Patel Samaj, Nikol–Naroda
# Database Restore Script (PostgreSQL / SQLite)
# =============================================================================

set -e

BACKUP_FILE="$1"
FORCE_RESTORE="$2"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path_to_backup_file.gz> [--force]"
  echo "Example: $0 ./backups/patel_samaj_pg_20261106_120000.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "---------------------------------------------------------"
echo "Database Restore Utility"
echo "Target File: $BACKUP_FILE"
echo "---------------------------------------------------------"

if [ "$FORCE_RESTORE" != "--force" ]; then
  read -p "⚠️ WARNING: This will overwrite existing database records! Are you sure? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Restore aborted by administrator."
    exit 0
  fi
fi

if [[ "$BACKUP_FILE" == *".sql.gz"* ]]; then
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable must be set to restore PostgreSQL database."
    exit 1
  fi

  echo "Restoring PostgreSQL database from $BACKUP_FILE..."
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
  echo "✅ PostgreSQL database restore completed successfully."

elif [[ "$BACKUP_FILE" == *".db.gz"* ]]; then
  echo "Restoring SQLite database to ./prisma/dev.db..."
  gunzip -c "$BACKUP_FILE" > ./prisma/dev.db
  echo "✅ SQLite database restored to ./prisma/dev.db successfully."

else
  echo "❌ Error: Unrecognized backup format. Expected .sql.gz or .db.gz"
  exit 1
fi

echo "Verifying restored tables..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const users = await prisma.user.count();
  const facilities = await prisma.facility.count();
  const bookings = await prisma.booking.count();
  console.log('Restored Data Summary:');
  console.log(' - Users:', users);
  console.log(' - Facilities:', facilities);
  console.log(' - Bookings:', bookings);
  await prisma.\$disconnect();
}
check();
"

echo "✅ Restore operation completed successfully."

