#!/bin/bash
# Database migration script
set -euo pipefail

echo "🔄 Running database migrations..."

# Wait for database to be ready
until pg_isready -h postgres -p 5432 -U postgres; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 1
done

echo "✅ PostgreSQL is ready"

# Run migrations if they exist
if [ -f "/app/scripts/migrate.js" ]; then
  echo "📦 Running Node.js migrations..."
  node /app/scripts/migrate.js
elif [ -f "/app/prisma/migrations" ]; then
  echo "📦 Running Prisma migrations..."
  npx prisma migrate deploy
else
  echo "📝 No migrations found - creating basic schema..."
  # Create basic tables if no migration system exists
  psql $DATABASE_URL -c "
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS compositions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      hash VARCHAR(255) UNIQUE NOT NULL,
      audio_url TEXT,
      viz_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_compositions_hash ON compositions(hash);
    CREATE INDEX IF NOT EXISTS idx_compositions_user_id ON compositions(user_id);
  "
fi

echo "✅ Database migrations completed"
