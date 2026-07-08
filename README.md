# AI Business Operating System

A multi-tenant business management app built with Next.js 16, Prisma, and Postgres. Each company gets its own scoped workspace covering CRM, Inventory, Sales, Invoicing, Accounting, HR, Payroll, Projects, Support, and an AI Assistant with tool-calling and human-approved actions.

## Tech stack

- **Next.js 16** (App Router, Server Actions)
- **Prisma 7** with Postgres (via `@prisma/adapter-pg`)
- **Tailwind CSS 4**
- **Zod** for validation
- **Groq** (free API) for the AI Assistant chat
- **Resend** for transactional email (password reset)

## Prerequisites

- Node.js 20+
- npm
- A Postgres database (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com) — both have a free tier)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

   This also runs `prisma generate` automatically via the `postinstall` script.

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `DATABASE_URL` | Postgres connection string, e.g. from Neon or Supabase. |
   | `JWT_SECRET` | Secret used to sign session cookies. Use a long random string in production. |
   | `GROQ_API_KEY` | Free API key for the AI Assistant. Get one at [console.groq.com/keys](https://console.groq.com/keys) — no card required. |
   | `RESEND_API_KEY` | API key for sending password-reset emails. Get one at [resend.com](https://resend.com) — free tier available. |
   | `RESEND_FROM_EMAIL` | The "from" address used when sending email. `onboarding@resend.dev` works for testing before you verify your own domain. |

3. **Create the database**

   ```bash
   npm run db:migrate
   ```

   This applies all Prisma migrations to your Postgres database. Use `npm run db:deploy` (`prisma migrate deploy`) in CI/production instead — it applies existing migrations without prompting to create new ones.

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
| `npm run test` | Run the Vitest unit test suite |
| `npm run db:migrate` | Create and apply a new Prisma migration (dev) |
| `npm run db:deploy` | Apply existing migrations without prompting (CI/production) |
| `npm run db:seed` | Seed the database |
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
