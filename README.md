# SeatIQ

Smart seating optimization for corporate events. Maximize networking opportunities, ensure balanced conversations, and create meaningful connections.

## Features

- **Deterministic Seating Optimization**: Rule-based algorithm that guarantees constraint satisfaction
- **Four Optimization Objectives**:
  - A) Maximize new professional connections
  - B) Maximize cross-department/company interaction
  - C) Maximize balanced, high-quality conversations
  - D) Maximize sales & transactional opportunities
- **AI-Assisted Guest Import**: Parse guest lists from CSV with AI-powered field detection
- **Constraint Management**: Must sit together, must not sit together, buyer/seller rules
- **Interactive Seating UI**: Drag-and-drop table editing with real-time updates
- **PDF Export**: Professional seating charts and guest lists

## Prerequisites

You only need **Docker Desktop** installed on your machine.

### Installing Docker Desktop

1. **Download Docker Desktop**:
   - Visit: https://www.docker.com/products/docker-desktop/
   - Download for your operating system

2. **Install and Start**:
   - Run the installer
   - Start Docker Desktop
   - Wait for it to fully start (whale icon stops animating)

3. **Verify Installation**:
   ```bash
   docker --version
   docker compose version
   ```

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/seatiq.git
   cd seatiq
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Start the development environment**:
   ```bash
   docker compose up
   ```

   First run takes a few minutes to download images and install dependencies.

4. **Open the app**:
   - Visit http://localhost:3000

## Development Commands

All commands run inside Docker containers - no local Node.js installation required.

```bash
# Start development environment
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f app

# Stop everything
docker compose down

# Run tests
docker compose exec app pnpm test

# Run linting
docker compose exec app pnpm lint

# Run type checking
docker compose exec app pnpm typecheck

# Database migrations
docker compose exec app pnpm prisma migrate dev

# Open Prisma Studio (database GUI)
docker compose exec app pnpm prisma studio

# Rebuild after package.json changes
docker compose build app && docker compose up -d

# Full reset (warning: deletes database data)
docker compose down -v && docker compose up
```

## Project Structure

```
seatiq/
├── apps/
│   └── web/                 # Next.js frontend + API routes
│       ├── src/
│       │   └── app/         # Next.js App Router pages
│       └── prisma/          # Database schema and migrations
├── packages/
│   ├── engine/              # Deterministic seating optimizer
│   │   └── src/
│   │       ├── optimizer.ts # Core optimization algorithm
│   │       ├── scoring.ts   # Objective scoring functions
│   │       └── constraints.ts # Constraint validation
│   └── shared/              # Shared types, schemas, utilities
├── docs/                    # Documentation
├── infra/                   # Infrastructure as Code
├── .github/workflows/       # CI/CD pipelines
├── docker-compose.yml       # Development environment
└── Dockerfile               # Production container
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (auto-configured for Docker) |
| `NEXTAUTH_SECRET` | Secret for session encryption | Yes |
| `NEXTAUTH_URL` | Base URL of your app | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |

## Architecture

### Deterministic-First Approach

SeatIQ uses a deterministic algorithm to ensure:
1. **Hard constraints are always satisfied** (must sit together, must not sit together)
2. **Reproducible results** (same input = same output)
3. **No AI hallucination** in explanations

AI is used only for:
- Parsing guest data from unstructured text
- Converting reason codes to human-readable explanations

### Optimization Algorithm

1. **Validation**: Check feasibility of constraints
2. **Initial Assignment**: Greedy placement respecting hard constraints
3. **Local Search**: Iterative improvement via swaps and moves
4. **Scoring**: Calculate weighted objective scores
5. **Explanation**: Generate reason codes and summaries

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js (magic link)
- **AI**: OpenAI GPT-4o-mini (optional)
- **Deployment**: Vercel (frontend), Supabase (database)

## Contributing

1. Create an issue for the feature/bug
2. Fork the repository
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
