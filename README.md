# AI Business Operating System

A multi-tenant business management app built with Next.js 16, Prisma, and SQLite. Each company gets its own scoped workspace covering CRM, Inventory, Sales, Invoicing, Accounting, HR, Payroll, Projects, Support, and an AI Assistant.

## Tech stack

- **Next.js 16** (App Router, Server Actions)
- **Prisma 7** with SQLite (via `@prisma/adapter-better-sqlite3`)
- **Tailwind CSS 4**
- **Zod** for validation
- **Groq** (free API) for the AI Assistant chat

## Prerequisites

- Node.js 20+
- npm

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

   This also runs `prisma generate` automatically via the `postinstall` script.

2. **Configure environment variables**

   Create a `.env` file in the project root:

   ```bash
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="a-long-random-string"
   GROQ_API_KEY="your-groq-api-key"
   ```

   | Variable | Description |
   | --- | --- |
   | `DATABASE_URL` | SQLite connection string. `file:./dev.db` works out of the box. |
   | `JWT_SECRET` | Secret used to sign session cookies. Use a long random string in production. |
   | `GROQ_API_KEY` | Free API key for the AI Assistant. Get one at [console.groq.com/keys](https://console.groq.com/keys) — no card required. |

3. **Create the database**

   ```bash
   npm run db:push
   ```

   This applies the Prisma schema to a fresh `dev.db` SQLite file.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). If port 3000 is taken, Next.js will pick the next free port and print it in the terminal.

5. **Create an account**

   Go to `/register` to create a company workspace and your first user, then sign in at `/login`.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:studio` | Open Prisma Studio to browse/edit data |

## Project structure

- `src/app/dashboard/<module>` — pages for each business module (list, detail, new, edit)
- `src/lib/actions/<module>.ts` — Server Actions (create/update/delete, always scoped by `companyId`)
- `src/lib/validation/<module>.ts` — Zod schemas and form state types
- `src/components/<module>/*-form.tsx` — client form components
- `src/lib/ai.ts` — Groq client used by the AI Assistant
- `prisma/schema.prisma` — full data model for every module

## Note on Next.js version

This project pins a Next.js release with some API differences from the publicly documented version. See `node_modules/next/dist/docs/` for the version-specific docs before assuming standard Next.js behavior.
