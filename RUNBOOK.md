# SeatIQ Runbook

Operations guide for running and maintaining SeatIQ.

## Table of Contents

1. [Local Development](#local-development)
2. [Database Operations](#database-operations)
3. [Deployment](#deployment)
4. [Troubleshooting](#troubleshooting)
5. [Monitoring](#monitoring)

---

## Local Development

### First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/seatiq.git
cd seatiq

# 2. Create environment file
cp .env.example .env

# 3. Start Docker environment
docker compose up

# 4. Wait for "Ready" message, then visit http://localhost:3000
```

### Daily Development

```bash
# Start development environment
docker compose up -d

# View logs
docker compose logs -f app

# Stop when done
docker compose down
```

### Running Commands Inside Container

```bash
# Run any pnpm command
docker compose exec app pnpm <command>

# Examples:
docker compose exec app pnpm test
docker compose exec app pnpm lint
docker compose exec app pnpm typecheck
docker compose exec app pnpm prisma studio
```

### Rebuilding After Changes

```bash
# After changing package.json or pnpm-lock.yaml
docker compose build app
docker compose up -d

# Full rebuild (clears caches)
docker compose down
docker compose build --no-cache app
docker compose up -d
```

---

## Database Operations

### Run Migrations

```bash
# Create and apply new migration
docker compose exec app pnpm prisma migrate dev --name <migration_name>

# Apply pending migrations (production)
docker compose exec app pnpm prisma migrate deploy
```

### Reset Database

```bash
# Reset and re-seed (WARNING: deletes all data)
docker compose exec app pnpm prisma migrate reset
```

### Access Database

```bash
# Open Prisma Studio (visual database editor)
docker compose exec app pnpm prisma studio

# Connect with psql
docker compose exec db psql -U postgres -d seatiq
```

### Backup Database

```bash
# Export database
docker compose exec db pg_dump -U postgres seatiq > backup.sql

# Import database
cat backup.sql | docker compose exec -T db psql -U postgres -d seatiq
```

---

## Deployment

### Prerequisites

1. **Vercel Account**: https://vercel.com/signup
2. **Supabase Account**: https://supabase.com
3. **OpenAI API Key** (optional): https://platform.openai.com

### Supabase Setup

1. Create new project at https://app.supabase.com
2. Go to Project Settings > Database
3. Copy the connection string (URI format)
4. Replace `[YOUR-PASSWORD]` with your database password

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel: https://vercel.com/import
3. Configure environment variables:
   - `DATABASE_URL`: Supabase connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your Vercel URL (e.g., https://seatiq.vercel.app)
   - `OPENAI_API_KEY`: Your OpenAI key (optional)
4. Deploy

### Running Migrations on Production

```bash
# Set DATABASE_URL to production
export DATABASE_URL="postgresql://..."

# Run migrations
pnpm --filter @seatiq/web prisma migrate deploy
```

---

## Troubleshooting

### Docker Issues

**Container won't start**
```bash
# Check logs
docker compose logs app

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up
```

**Port 3000 already in use**
```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

**Database connection refused**
```bash
# Check if database is running
docker compose ps

# Restart database
docker compose restart db

# Check database logs
docker compose logs db
```

### Build Errors

**Prisma client not generated**
```bash
docker compose exec app pnpm prisma generate
```

**Type errors in packages**
```bash
# Build packages first
docker compose exec app pnpm --filter @seatiq/shared build
docker compose exec app pnpm --filter @seatiq/engine build
```

**Node modules out of sync**
```bash
# Remove volumes and reinstall
docker compose down -v
docker compose up
```

### Common Errors

**"Cannot find module '@seatiq/engine'"**
- Run: `docker compose exec app pnpm --filter @seatiq/engine build`

**"NEXTAUTH_SECRET must be set"**
- Add NEXTAUTH_SECRET to .env file
- Generate with: `openssl rand -base64 32`

**"Database does not exist"**
- Database creates automatically on first run
- If issues persist: `docker compose down -v && docker compose up`

---

## Monitoring

### Viewing Logs

```bash
# All logs
docker compose logs -f

# App logs only
docker compose logs -f app

# Database logs only
docker compose logs -f db

# Last 100 lines
docker compose logs --tail 100 app
```

### Health Checks

```bash
# Check container status
docker compose ps

# Check app health
curl http://localhost:3000/api/health

# Check database health
docker compose exec db pg_isready -U postgres
```

### Performance

```bash
# Container resource usage
docker stats

# Database connections
docker compose exec db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | (Docker default) |
| `NEXTAUTH_SECRET` | Auth session encryption key | Yes | - |
| `NEXTAUTH_URL` | Base URL of application | Yes | http://localhost:3000 |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No | - |
| `NODE_ENV` | Environment (development/production) | No | development |

---

## Quick Reference

```bash
# Start development
docker compose up -d

# Stop development
docker compose down

# View logs
docker compose logs -f app

# Run tests
docker compose exec app pnpm test

# Database GUI
docker compose exec app pnpm prisma studio

# Full reset
docker compose down -v && docker compose up
```
