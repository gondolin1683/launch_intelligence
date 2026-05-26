# Venture Radar

Venture Radar is a VC Theme Intelligence Dashboard for LAUNCH venture research. It tracks public-style signals from Sequoia, a16z, Y Combinator, and their partners, then synthesizes those signals into ranked investable themes.

The product is intentionally not a generic feed of posts. The homepage answers the Monday-morning question: what are elite VCs focused on right now, what evidence supports that read, and what should LAUNCH research next?

## Why This Matters

Venture researchers need to notice theme formation before it is obvious. Partner commentary, firm requests for startups, founder updates, and public product activity can all become early evidence that a category is heating up.

This prototype turns public signal noise into a briefing workflow:

- See ranked VC themes immediately.
- Understand which firms are involved across Sequoia, a16z, and YC.
- Review partner chatter, cross-firm validation, and investment activity.
- Inspect representative supporting evidence.
- Generate a concise weekly partner memo for LAUNCH.

## Prototype Scope

This is a polished MVP, not a full production intelligence platform.

P0 included:

- Single-page Next.js theme intelligence dashboard.
- Real tracked-account universe for the first ingestion pass:
  - 46 partner / investing-team X accounts
- Ranked theme cards as the primary homepage experience.
- Theme-level fields:
  - signal strength score
  - firms involved
  - partner chatter count
  - cross-firm presence
  - investment activity count
  - “what they are saying” synthesis
  - “why this matters” explanation
  - representative supporting signals
- Supporting evidence section for the top-ranked theme.
- Deterministic LAUNCH-style weekly partner memo.
- Curated seed data for reliable demos without credentials.
- Optional `/api/signals` route that uses X API recent search when `X_BEARER_TOKEN` is configured and falls back to seed data otherwise.

P1 included lightly:

- Related Companies / Opportunities section under the theme workflow.
- This is intentionally secondary and does not drive the MVP.

Not included:

- Auth
- Database
- OAuth
- Background jobs
- LinkedIn scraping
- Unofficial scraping of private or gated sources
- A generic social feed as the main product

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```bash
npm run typecheck
npm run build
```

Optional X API live mode:

```bash
X_BEARER_TOKEN=your_token npm run dev
```

Then visit [http://localhost:3000/api/signals](http://localhost:3000/api/signals). If the token is missing or the API request fails, the app returns curated seed data.

## Weekly Ingestion

The production-style ingestion path lives in `aws/`.

It uses:

- EventBridge weekly schedule
- Lambda
- DynamoDB
- Secrets Manager for the X API Bearer Token

See `aws/README.md` for setup and deployment.

## Current Data Sources

The prototype uses curated public-style seed data in:

- `data/themes.json`
- `data/partners.json`
- `data/trackedAccounts.json`
- `data/signals.json`
- `data/opportunities.json`

The tracked account universe uses real public X handles sourced from official firm and people pages where available. The theme and signal content remains curated public-style seed data for demo reliability.

The MVP treats `data/themes.json` as the primary product data. `data/signals.json` supports the themes as evidence rather than acting as the main user experience.

## Production Architecture

A production version would use compliant API access and approved integrations:

- X API for tracked VC partner and firm accounts.
- Approved LinkedIn integrations or manually curated LinkedIn research workflows. LinkedIn should not be scraped unofficially.
- YC RFS, YC company directory, batch launches, and founder announcements.
- a16z and Sequoia blogs, podcasts, newsletters, and investment announcements.
- Company blogs, changelogs, launch posts, GitHub, Product Hunt, Hacker News, and relevant developer communities.
- CRM integrations for watchlists, partner notes, founder intros, and follow-up status.

Suggested architecture:

- Ingestion workers for compliant APIs and public RSS/source feeds.
- Normalization layer that maps authors, firms, partner roles, source quality, and engagement.
- Theme classifier using embeddings plus rules for known LAUNCH priority areas.
- Theme intelligence layer that ranks themes by momentum, cross-firm validation, partner chatter, and investment activity.
- Evidence store that links representative signals to themes.
- Memo generation, watchlists, and CRM sync.

## Known Limitations

- Seed data is curated public-style prototype data, not live investment intelligence.
- Partner account maps are a strong initial universe, not a complete production-grade coverage map.
- X API live mode is minimal and credential-gated.
- Theme classification in live mode uses simple keyword rules.
- Theme scores in the MVP are curated for demo clarity rather than learned from long-term historical data.
- No deduplication, entity resolution, or longitudinal trend history.
- No LinkedIn ingestion because unofficial scraping would be brittle and non-compliant.
- No database, so watchlists and user edits are not persisted.

## Demo Pitch

“This prototype shows what elite VCs are focused on right now. It ranks investable themes, backs each theme with public venture signals, shows what partners are saying, and generates a LAUNCH-style weekly research memo.”
