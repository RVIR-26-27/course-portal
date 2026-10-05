# course-portal (public)

Course portal for the optional Flutter intro labs (React + TypeScript + Vite,
GitHub Pages). This repository is **public by design** and contains no answer
keys, hidden tests, rosters or secrets: all sensitive logic runs in Supabase
Edge Functions and Postgres (RLS), and official grading runs in a private
repository.

```bash
npm ci
cp .env.example .env.local   # public Supabase URL + anon/publishable key
npm run dev
npm test
npm run build
```

Deployment: `.github/workflows/pages.yml` (repository variables `SUPABASE_URL`,
`SUPABASE_ANON_KEY`). `keepalive.yml` prevents the free Supabase project from
pausing.
