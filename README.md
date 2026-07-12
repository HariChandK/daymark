# Daymark

**Plan the day. Remember the life.**

Daymark is a responsive, full-stack daily planner and private journal. It brings tasks, deadlines, mood, energy, reflection, and the story of each day into one calm workspace.

## What makes it different

Daymark treats every date as a complete record—not merely a checklist. Its **Close the Day** ritual records a closing summary in the journal and intentionally carries unfinished tasks forward, so plans never silently disappear.

## Features

- Add, edit, complete, prioritize, reschedule, and delete tasks
- Daily timeline and progress view
- Private journal entries with editing and deletion
- Mood and energy check-ins
- Searchable journal history
- Close-the-day ritual with automatic task carry-forward
- Responsive phone and desktop layouts
- Sign in with any Google account through Supabase Auth
- Separate, private data for every signed-in user
- Cloudflare D1 persistence with Drizzle migrations

## Privacy model

The website is publicly accessible, but all personal content requires sign-in. Every database record is associated with the verified signed-in user's email, and server-side queries enforce that ownership. Source code in this repository contains no diary entries, tasks, private credentials, or production user data. The Supabase publishable key used by the browser is intentionally public; Google OAuth secrets remain outside GitHub.

## Technology

- React and Next.js-compatible Vinext
- TypeScript
- Cloudflare Workers and D1
- Supabase Auth and Google OAuth
- Drizzle ORM
- Tailwind CSS
- Sites hosting

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run lint
npm run build
```

## Database migrations

```bash
npm run db:generate
```

## License

No license has been selected yet. All rights are reserved unless a license is added later.
