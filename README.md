# Openclaw Health

Health monitoring dashboard built with Next.js, SQLite, and Prisma.

## Tech Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** SQLite (local file)
- **ORM:** Prisma 6
- **UI:** Custom components + Tailwind

## Modules

- Dashboard - Health overview and stats
- Doctor - Medical professional management
- HealthChecks - Health monitoring and checkups
- Workspace - Workspace management
- Security - Security logs and audit
- Config - System configuration

## Getting Started

```bash
npm install
npx prisma generate
npm run dev
```

Server runs on http://localhost:4005

## Database

SQLite database file: `prisma/dev.db`

## License

MIT
