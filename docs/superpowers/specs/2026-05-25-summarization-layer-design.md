# Venture Radar — Summarization Layer Design

**Date:** 2026-05-25
**Status:** Approved (design); pending implementation plan

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
- **Trigger + persistence:** on-demand. A "Generate synthesis" button calls a
  Next.js API route, which reads the latest week's tweets, calls the LLM, and
  writes the result back to DynamoDB. The dashboard reads the latest stored result
  on load, with seed JSON as fallback.
- **Pipeline structure (approach C):** LLM classify → deterministic rank → LLM
  narrative. Chosen so the "AI clusters live VC data" story holds *and* the ranking
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

## Phase 0 — Account migration (prerequisite, infra)

The deploy script `scripts/deploy-aws-ingestion.sh` derives the account from
ambient credentials (`aws sts get-caller-identity`) and takes no `--profile` flag.

1. Redeploy into `536068784559`:
   `AWS_PROFILE=sthumm_dev X_BEARER_TOKEN="<rotated token>" ./scripts/deploy-aws-ingestion.sh`
   This creates the DynamoDB table, IAM role, Lambda, EventBridge rule, and the
   Secrets Manager secret in the new account. The new account has no secret yet, so
   `X_BEARER_TOKEN` must be passed — the natural moment to **rotate** the token
   (flagged as required for handoff).
2. Invoke once to populate the new table; verify item count and the EventBridge
   schedule.
3. The old `340342921626` resources are left abandoned for now (cleanup needs the
   default profile — deferred/optional).

## Section 1 — Summarization pipeline (approach C)

New module under `app/lib/summarize/`. Provider-agnostic `LlmClient` interface with
Anthropic and OpenAI implementations, so the pipeline accepts an injected client
and is testable with a mock and degrades to a deterministic path.

1. **Read** the latest week's `X_POST` items from DynamoDB. Compute the current ISO
   week key (matching the Lambda's `isoWeekKey` logic) and query `PK=WEEK#<key>`,
   filtering `entityType = X_POST`. If empty or DynamoDB is unreachable, fall back to
   seed signals.
2. **Classify (selected model, batched ~30 tweets/call):** each tweet →
   `{ themeLabel, investmentRelevant: boolean, why }`. Tweets with
   `investmentRelevant = false` are dropped (the noise filter).
3. **Rank (deterministic — reuse/extend `app/lib/scoring.ts`):** group surviving
   tweets by theme and compute per theme: `signalStrength`, `firmsInvolved`,
   `partnerSignalCount`, and representative tweet IDs. Ranking logic is deterministic
   and explainable.
4. **Narrative (same selected model):** generate `whatTheyAreSaying` and
   `whyItMatters` per top theme plus the weekly partner memo, grounded in the
   representative real tweets.

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
      "representativeTweetIds": ["...", "..."]
    }
  ],
  "memo": { "title": "Weekly VC Theme Brief", "body": "..." },
  "meta": { "provider": "anthropic", "model": "claude-sonnet-4-6", "generatedAt": "...", "mode": "llm" }
}
```

`meta.mode` is `"llm"` or `"deterministic"` so the UI/response can indicate which
path produced the result.

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
- Error handling:
  - No key → run deterministic fallback; response `meta.mode = "deterministic"`.
  - LLM call fails → deterministic fallback.
  - DynamoDB unreachable → generate over seed tweets and skip persistence.

## Section 4 — Frontend

- **Read path (server component, `app/page.tsx`):** on load, read `SUMMARY#LATEST`
  from DynamoDB and render the generated themes/memo. If absent or DynamoDB is
  unavailable, fall back to the existing `data/themes.json` / `data/signals.json`.
  Existing layout and sections are preserved.
- **Generate path (new client component):** a "Generate synthesis" panel with a
  provider select, a model field (per-provider defaults + custom entry), and an
  API-key password input (held in component state only, not persisted to
  localStorage). The button POSTs to `/api/summarize`, shows a loading state, and
  re-renders with the returned themes/memo.
- The existing deterministic `app/lib/memo.ts` and `app/lib/scoring.ts` remain as the
  fallback generator.

### Model options offered in the UI

- Anthropic: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` (+ custom).
- OpenAI: provider option with a custom-entry model field.

## Testing

- Unit-test the deterministic ranking/aggregation (pure function) with fixture tweets.
- Test the pipeline with a mock `LlmClient`, including the deterministic fallback path
  (runnable without any API key).
- Test the API route: input validation and each fallback branch (no key, LLM failure,
  DynamoDB unavailable).
- `npm run typecheck` and `npm run build` pass.
- Manual end-to-end browser run with a real key, after Phase 0 populates the new
  account.

## New types (sketch)

`GeneratedTheme`, `WeeklyMemo`, `SummaryResult`, and an `LlmClient` interface
(provider-agnostic) with Anthropic and OpenAI implementations.

## Out of scope (YAGNI)

Auth, multi-week history UI (history items are stored but the UI shows latest),
response streaming, and any caching beyond the DynamoDB-persisted result.

## Security notes

- API key is BYOK and transient: never stored, logged, or echoed back.
- Rotate the X bearer token during Phase 0; never commit credentials.
- AWS access via the `sthumm_dev` profile / role; secrets live in Secrets Manager.
