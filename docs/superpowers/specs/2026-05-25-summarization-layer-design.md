# Venture Radar — Summarization Layer Design

**Date:** 2026-05-25
**Status:** Approved (design). Phase 0 (account migration) complete. Building
interactively under user direction (no separate implementation plan, by request).

## Goal

Add the "intelligence" layer that turns ingested partner tweets in DynamoDB into
ranked venture themes and a LAUNCH-style weekly partner memo, and surface that
output in the dashboard. Ingestion already exists and works (deployed Lambda →
DynamoDB `venture-radar-signals`, `X_POST` items with full tweet text). The
dashboard currently reads only static seed JSON and never touches DynamoDB.

## Decisions (locked during brainstorming)

- **AI approach:** LLM with a deterministic fallback (demo-safe; no key → still works).
- **Key handling — bring your own key (BYOK):** the user selects provider + model
  and supplies their own API key *in the dashboard UI*. The key is used transiently
  server-side and is never stored, persisted, or logged.
- **Trigger + persistence:** on-demand. The user supplies provider + model + key up
  front, then a "Generate synthesis" action calls a Next.js API route, which reads the
  latest week's tweets, runs the LLM pipeline, and writes the result back to DynamoDB.
  The dashboard reads the latest stored result on load, with seed JSON as fallback.
- **Two grounded inputs:** themes are synthesized from (1) the ingested partner
  **tweets** and (2) a bounded **web-research pass** on "what a16z / YC / Sequoia are
  investing in" — ~3–5 sources per firm, with citations. This avoids relying on the
  model's latent knowledge ("where's this from?" has a real, citable answer).
- **Web access = the provider's native web-search tool:** the BYOK LLM call enables
  the provider's built-in web search (Anthropic / OpenAI), so searches are billed to
  the user's key and return citations — no separate search-API key. If the chosen
  provider/model does not support web search, the pipeline degrades to **tweets-only**
  (still grounded, just without the firm web context).
- **Pipeline structure (approach C):** LLM classify → deterministic rank → web-grounded
  LLM synthesis. Chosen so the "AI clusters live VC data" story holds *and* the ranking
  stays transparent/defensible.
- **Single model for the pipeline:** the one model the user selects in the UI is used
  for both the classify and narrative LLM stages. (The handoff's cheap-classifier /
  better-narrative split is noted as an optional future optimization, deferred to keep
  BYOK to one provider+model choice.)
- **Target AWS account:** `536068784559` via the `sthumm_dev` profile, region
  `us-east-1`. The stack was first deployed to `340342921626` by mistake; it must be
  migrated. (The original handoff doc's account ID is stale.)

## Validation from the scrape test (2026-05-25)

A 24-hour test scrape returned 124 tweets across 46 accounts (YC 61, a16z 60,
Sequoia 3, 0 errors). Two findings shaped this design:

- **Lopsided short-window volume** — Sequoia partners are nearly silent on a 1-day
  window. Themes therefore use the **7-day** window (the default schedule); shorter
  windows are spot-check only.
- **Heavy noise** — top-engagement tweets are largely culture/politics, not
  investing signal. The pipeline must **filter for investment relevance** before
  ranking, rather than treating every partner tweet as a venture signal.

## Phase 0 — Account migration (COMPLETE, 2026-05-25)

Redeployed the ingestion stack into `536068784559` via
`AWS_PROFILE=sthumm_dev ./scripts/deploy-aws-ingestion.sh`. Outcome:

- DynamoDB table, IAM role, Lambda, EventBridge rule (`cron(0 14 ? * MON *)`,
  ENABLED), and Secrets Manager secret all live and verified in the new account.
  EventBridge → Lambda invoke permission confirmed present.
- Populated with a 7-day backfill: **914 tweets** stored for `WEEK#2026-05-25`, 0 errors.
- **Token was reused, not rotated** (user's call) — the X bearer token still needs
  rotation before final handoff.
- Old `340342921626` resources left abandoned (cleanup deferred).
- 14-day backfill is not possible via the recent-search endpoint (7-day cap); would
  require the full-archive endpoint (elevated tier) or schedule accumulation over time.

## Section 1 — Summarization pipeline (approach C)

New module under `app/lib/summarize/`. Provider-agnostic `LlmClient` interface with
Anthropic and OpenAI implementations. The interface exposes whether the
provider/model supports web search and a web-search-enabled generation call, so the
pipeline accepts an injected client, is testable with a mock, and degrades to a
deterministic path.

1. **Read** the latest week's `X_POST` items from DynamoDB. Compute the current ISO
   week key (matching the Lambda's `isoWeekKey` logic) and query `PK=WEEK#<key>`,
   filtering `entityType = X_POST`. If empty or DynamoDB is unreachable, fall back to
   seed signals.
2. **Classify (selected model, batched ~30 tweets/call):** each tweet →
   `{ themeLabel, investmentRelevant: boolean, why }`. Tweets with
   `investmentRelevant = false` are dropped (the noise filter).
3. **Firm web-research (selected model + provider web-search tool, one call per firm):**
   for each of a16z, YC, Sequoia, run a bounded web search (~3–5 sources) for what the
   firm is currently investing in. Capture a short summary plus the citations (title +
   URL). Skipped entirely if the provider/model lacks web search → pipeline continues
   tweets-only. Capped per firm so we "don't go overboard."
4. **Rank (deterministic — reuse/extend `app/lib/scoring.ts`):** group surviving
   tweets by theme and compute per theme: `signalStrength`, `firmsInvolved`,
   `partnerSignalCount`, and representative tweet IDs. Ranking logic is deterministic
   and explainable. (Web context is grounding for synthesis, not a ranking input, so
   ranking stays defensible.)
5. **Synthesis (same selected model):** generate `whatTheyAreSaying` and `whyItMatters`
   per top theme plus the weekly partner memo, grounded in both the representative real
   tweets and the per-firm web research. Each theme carries the citations that informed
   it.

### Output shape

```json
{
  "weekKey": "2026-05-25",
  "themes": [
    {
      "name": "AI Agents for Enterprise Workflows",
      "signalStrength": 91,
      "firmsInvolved": ["a16z", "YC"],
      "partnerSignalCount": 12,
      "whatTheyAreSaying": "...",
      "whyItMatters": "...",
      "representativeTweetIds": ["...", "..."],
      "citations": [{ "title": "...", "url": "https://..." }]
    }
  ],
  "memo": { "title": "Weekly VC Theme Brief", "body": "..." },
  "meta": {
    "provider": "anthropic", "model": "claude-sonnet-4-6", "generatedAt": "...",
    "mode": "llm", "webGrounded": true
  }
}
```

`meta.mode` is `"llm"` or `"deterministic"`; `meta.webGrounded` indicates whether the
firm web-research step ran (false when the provider/model lacks web search). Together
they let the UI show how the result was produced.

## Section 2 — Persistence

Write the result back to DynamoDB as a `WEEKLY_MEMO` item:

- `PK = WEEK#<key>`, `SK = SUMMARY#<generatedAt>` (history), plus an overwritten
  `SK = SUMMARY#LATEST` pointer for cheap single-item reads.
- `entityType = WEEKLY_MEMO`; body stores the full themes + memo JSON and `meta`.

## Section 3 — API route

`app/api/summarize/route.ts`, `POST`.

- Request body: `{ provider, model, apiKey, weekKey? }`.
- `apiKey` is used transiently only: never persisted, never logged, redacted from any
  error surfaced to the client or logs.
- Validates input (provider in allowed set, model non-empty, key present for the LLM
  path). Guards request body size.
- Web search is performed by the provider as part of the BYOK call and billed to the
  user's key; we cap it to ~3–5 sources per firm.
- Error handling:
  - No key → run deterministic fallback; response `meta.mode = "deterministic"`.
  - LLM call fails → deterministic fallback.
  - Provider/model lacks web search → run tweets-only; `meta.webGrounded = false`.
  - Web search fails or returns nothing → continue tweets-only; `meta.webGrounded = false`.
  - DynamoDB unreachable → generate over seed tweets and skip persistence.

## Section 4 — Frontend

- **Read path (server component, `app/page.tsx`):** on load, read `SUMMARY#LATEST`
  from DynamoDB and render the generated themes/memo. If absent or DynamoDB is
  unavailable, fall back to the existing `data/themes.json` / `data/signals.json`.
  Existing layout and sections are preserved.
- **Generate path (new client component):** the user provides provider + model + key
  up front (a setup panel/modal) — a provider select, a model field (per-provider
  defaults + custom entry), and an API-key password input (held in component state
  only, not persisted to localStorage). A "Generate synthesis" action then POSTs to
  `/api/summarize`, shows a loading state, and re-renders with the returned
  themes/memo. Theme citations are shown as evidence; a small badge reflects
  `meta.mode` / `meta.webGrounded`.
- The existing deterministic `app/lib/memo.ts` and `app/lib/scoring.ts` remain as the
  fallback generator.

### Model options offered in the UI

- Anthropic: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` (+ custom).
- OpenAI: provider option with a custom-entry model field.

## Testing

- Unit-test the deterministic ranking/aggregation (pure function) with fixture tweets.
- Test the pipeline with a mock `LlmClient`, including the deterministic fallback path
  (runnable without any API key) and the no-web-search path (`webGrounded = false`).
- Test the API route: input validation and each fallback branch (no key, LLM failure,
  no web-search support, DynamoDB unavailable).
- `npm run typecheck` and `npm run build` pass.
- Manual end-to-end browser run with a real key, after Phase 0 populates the new
  account.

## New types (sketch)

`GeneratedTheme` (incl. `citations`), `Citation` (`{ title, url }`), `FirmResearch`
(per-firm summary + citations), `WeeklyMemo`, `SummaryResult`, and an `LlmClient`
interface (provider-agnostic) exposing web-search support + a web-search-enabled
call, with Anthropic and OpenAI implementations.

## Out of scope (YAGNI)

Auth, multi-week history UI (history items are stored but the UI shows latest),
response streaming, and any caching beyond the DynamoDB-persisted result.

## Security notes

- API key is BYOK and transient: never stored, logged, or echoed back.
- Rotate the X bearer token during Phase 0; never commit credentials.
- AWS access via the `sthumm_dev` profile / role; secrets live in Secrets Manager.
