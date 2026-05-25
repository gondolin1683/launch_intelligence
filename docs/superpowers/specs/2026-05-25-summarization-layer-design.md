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

- **AI approach:** LLM-generated, with the existing deterministic generator kept as a
  safety net when an LLM call fails mid-generation (so a run still produces something).
  The "no key available" case is handled by the key-selection rule below, not by
  silently producing a deterministic memo.
- **Automatic weekly generation:** memos generate on a schedule (no "Generate"
  button), like ingestion. A new summarization Lambda runs weekly, right after
  ingestion, reads the just-ingested week, runs the pipeline, and writes the
  `WEEKLY_MEMO` to DynamoDB. The dashboard just reads the latest stored memo.
- **Keys stored server-side (Secrets Manager):** generation runs unattended, so the
  LLM key must be available at run time — it is stored in Secrets Manager, not held
  transiently. Two keys: the **owner** key (developer's, always present) and the
  **user** key (saved when the user adds it via the dashboard). *This intentionally
  reverses the earlier transient-key decision* — automatic generation requires it.
  Keys are encrypted at rest, never committed, never logged.
- **Per-week key selection (first-one's-free):** use the user key if set; otherwise
  use the owner key for the **first** week only. From week 2 on, if no user key is
  stored, skip generation and have the dashboard prompt the user to add their key.
- **Adding a key is optional/deferrable** and offered in the dashboard. Saving a key
  also triggers an immediate (re)generation of the current week for instant feedback.
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
- **Single model for the pipeline:** one provider+model (stored alongside the key) is
  used for both the classify and synthesis LLM stages. (The handoff's cheap-classifier
  / better-synthesis split is noted as an optional future optimization, deferred.)
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

The pipeline runs **inside the scheduled summarization Lambda** (see Section 1a), using
the key/model read from Secrets Manager. It is written as a self-contained module
(shared with the Lambda package) so it can also be unit-tested locally. Provider-agnostic
`LlmClient` interface with
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

## Section 1a — Scheduled summarization Lambda

A second Lambda (`venture-radar-weekly-summary`, its own package under
`aws/weekly-summary/`) owns automatic generation:

- **Trigger:** runs weekly, right after ingestion. Simplest wiring is its own
  EventBridge rule a short delay after the 14:00 UTC Monday ingestion (or the
  ingestion Lambda invokes it on success). It also runs on-demand when the user saves
  a key (immediate regeneration of the current week).
- **Key/model:** reads credentials from Secrets Manager. Selection rule: user key if
  present; else owner key for the first week only; else (week 2+, no user key) write a
  `needsUserKey` marker instead of a memo and exit — the dashboard uses this to prompt.
- **Work:** runs the Section 1 pipeline over the week's `X_POST` items and writes the
  `WEEKLY_MEMO` (Section 2).
- Secrets: a `venture-radar/owner-llm-credentials` secret (provider+model+key) seeded
  by the developer, and a `venture-radar/user-llm-credentials` secret written by the
  save-key flow. IAM policy grants this Lambda read on both (and write is done by the
  API route's role, not the Lambda).

## Section 2 — Persistence

Write the result back to DynamoDB as a `WEEKLY_MEMO` item:

- `PK = WEEK#<key>`, `SK = SUMMARY#<generatedAt>` (history), plus an overwritten
  `SK = SUMMARY#LATEST` pointer for cheap single-item reads.
- `entityType = WEEKLY_MEMO`; body stores the full themes + memo JSON and `meta`.

## Section 3 — API route (save key, not generate)

Generation is now server-side/scheduled, so the API route no longer runs the
pipeline. `app/api/llm-credentials/route.ts`:

- `POST { provider, model, apiKey }` — validates input (provider in allowed set,
  model non-empty, key present), then writes the `venture-radar/user-llm-credentials`
  secret and invokes the summarization Lambda for the current week (immediate
  regeneration). The key is written straight to Secrets Manager; never logged,
  never echoed back in any response or error.
- `GET` — returns only non-secret status (whether a user key is set, provider/model,
  last-generated week). Never returns the key itself.
- Web search is performed by the provider inside the Lambda using the stored key,
  capped to ~3–5 sources per firm.
- The route's IAM role is the only identity with write access to the user-credentials
  secret and invoke access to the summary Lambda.

## Section 4 — Frontend

- **Read path (server component, `app/page.tsx`):** on load, read `SUMMARY#LATEST`
  from DynamoDB and render the generated themes/memo. If absent or DynamoDB is
  unavailable, fall back to the existing `data/themes.json` / `data/signals.json`.
  Existing layout and sections are preserved.
- **Key setup (client component), optional/deferrable:** a panel to add a key —
  provider select, model field (per-provider defaults + custom entry), API-key
  password input. Submitting POSTs to `/api/llm-credentials` (stored server-side);
  the field is cleared after submit. The dashboard never holds the key long-term.
- **Needs-key prompt:** when the latest week has a `needsUserKey` marker instead of a
  memo (week 2+, no user key), the dashboard shows a clear "add your API key to
  generate this week's memo" call-to-action linking to the key-setup panel.
- Theme citations are shown as evidence; a small badge reflects `meta.mode` /
  `meta.webGrounded` and whether the owner or user key produced it.
- The existing deterministic `app/lib/memo.ts` and `app/lib/scoring.ts` remain as the
  fallback generator for the no-/failed-LLM case.

### Model options offered in the UI

- Anthropic: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` (+ custom).
- OpenAI: provider option with a custom-entry model field.

## Testing

- Unit-test the deterministic ranking/aggregation (pure function) with fixture tweets.
- Test the pipeline with a mock `LlmClient`, including the deterministic fallback path
  (runnable without any API key) and the no-web-search path (`webGrounded = false`).
- Test the per-week key-selection rule (user key set; first-week owner-key fallback;
  week 2+ no user key → `needsUserKey` marker).
- Test the `/api/llm-credentials` route: input validation, that the key is written to
  Secrets Manager and never returned, and that `GET` exposes status only.
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

- LLM keys (owner + user) are stored in Secrets Manager (encrypted at rest),
  required because generation runs unattended. They are never logged, never echoed
  back in any API response/error, and never committed. The `GET` status endpoint
  exposes only whether a key is set, not the key.
- Write access to the user-credentials secret is limited to the API route's IAM role;
  the summary Lambda has read-only.
- X bearer token still needs rotation before final handoff (it was reused, not rotated,
  during the migration). Never commit credentials.
- AWS access via the `sthumm_dev` profile / role.
