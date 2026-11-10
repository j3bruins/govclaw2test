# GovClaw

Capture desk for federal grants and contracts. A team of people and desk agents can hold a large customer book, build a company profile from documents, score notices, turn requirements into a dated checklist, run that checklist as a project, and keep proposal drafts under version control.

## Run

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no `DATABASE_URL`, the app uses an in-memory Postgres-compatible database and loads the demonstration book on first request. A published deployment with `DATABASE_URL` uses Postgres and applies `migrations/` during the build.

## What is in the book

- 2,000 demonstration customers, twelve of them in active capture with documents, pods, and scored notices.
- Sample notices, clearly badged, so checklists and projects can be exercised without a portal call.
- Live search against the public Grants.gov API.
- SAM.gov contract search when `SAM_API_KEY` is set. The key stays on the server.

Start with Harbor & Pine Analytics, Kindred Workforce Partners, Northline Cyber Works, or Redcedar Infrastructure Group. Redcedar has a checklist that has not been turned into a project yet. Harbor and Kindred have proposal versions from both the GovClaw desk and the client.

Scores use the profile and the notice text: capability language, NAICS, eligibility, set-aside, past performance, time to close, and award scale. Drafts quote that material. They do not invent past performance, rates, or authorizations.
