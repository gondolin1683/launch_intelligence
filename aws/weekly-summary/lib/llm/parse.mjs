// Provider-neutral prompt builders and JSON-response parsers.
// The classify and synthesis JSON contracts are identical across providers,
// so Anthropic and OpenAI clients share these.

export function buildClassifyUserText(tweets) {
  const lines = tweets.map((t) => `[${t.tweetId}] ${(t.text ?? "").replace(/\s+/g, " ").trim()}`);
  return [
    "Classify each tweet below into a short venture theme label, and decide whether it is investment-relevant signal (true) or off-topic noise such as politics, personal life, or jokes (false).",
    'Respond ONLY with a JSON array of {"tweetId","theme","investmentRelevant"}.',
    "",
    ...lines
  ].join("\n");
}

export function buildSynthesisUserText({ weekKey, rankedThemes, firmResearch, tweetsByTheme }) {
  const themeContext = rankedThemes.map((t) => {
    const samples = (tweetsByTheme[t.name] ?? []).slice(0, 6).map((tw) => `- ${tw.text}`).join("\n");
    return `Theme: ${t.name} (signalStrength ${t.signalStrength}, firms ${t.firmsInvolved.join(", ")})\n${samples}`;
  }).join("\n\n");
  const firmContext = (firmResearch ?? []).map((r) => `${r.firm}: ${r.summary}`).join("\n");

  return [
    "You are a VC research analyst writing a weekly partner memo for LAUNCH.",
    `This memo covers the week of ${weekKey}. Use that exact date in the title — never a placeholder like "[Current Week]".`,
    "Using the ranked themes (derived from real partner tweets) and the firm web research below, write a sharp synthesis.",
    'Respond ONLY with JSON: {"themes":[{"name","whatTheyAreSaying","whyItMatters"}],"memo":{"title","body"}}.',
    "Use the exact theme names given. Ground claims in the tweets and firm research.",
    "",
    "RANKED THEMES + SAMPLE TWEETS:",
    themeContext,
    "",
    "FIRM WEB RESEARCH:",
    firmContext || "(none available)"
  ].join("\n");
}

export function buildConsolidateUserText(labelCounts) {
  const lines = labelCounts.map((l) => `- ${l.label} (${l.count})`);
  return [
    "Below are raw venture theme labels produced by classifying tweets independently, with tweet counts.",
    "Cluster near-duplicate and closely related labels into 8-12 canonical venture theme names.",
    'Respond ONLY with JSON: {"mappings":{"<raw label>":"<canonical theme>", ...}} covering every raw label.',
    "Prefer concise, investor-legible canonical names. Keep genuinely distinct themes separate.",
    "",
    ...lines
  ].join("\n");
}

export function parseConsolidationResponse(rawText, validLabels) {
  const valid = new Set(validLabels);
  let parsed;
  try {
    parsed = JSON.parse(stripFences(rawText));
  } catch {
    return {};
  }
  const mappings = parsed?.mappings;
  if (!mappings || typeof mappings !== "object") return {};

  const out = {};
  for (const [raw, canonical] of Object.entries(mappings)) {
    if (valid.has(raw) && typeof canonical === "string" && canonical.trim()) {
      out[raw] = canonical.trim();
    }
  }
  return out;
}

function stripFences(text) {
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export function parseClassifyResponse(rawText, batch) {
  const validIds = new Set(batch.map((t) => t.tweetId));
  let parsed;
  try {
    parsed = JSON.parse(stripFences(rawText));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out = [];
  for (const entry of parsed) {
    if (!entry || typeof entry.tweetId === "undefined") continue;
    const tweetId = String(entry.tweetId);
    if (!validIds.has(tweetId) || typeof entry.theme !== "string") continue;
    out.push({
      tweetId,
      theme: entry.theme,
      investmentRelevant: typeof entry.investmentRelevant === "boolean" ? entry.investmentRelevant : true
    });
  }
  return out;
}

export function parseSynthesisResponse(rawText, rankedThemes, firmResearch) {
  const parsed = JSON.parse(stripFences(rawText));
  if (!parsed || !Array.isArray(parsed.themes) || !parsed.memo) {
    throw new Error("synthesis response missing themes/memo");
  }

  const narrativeByName = new Map(parsed.themes.map((t) => [String(t.name ?? "").toLowerCase(), t]));
  const citationsByFirm = new Map((firmResearch ?? []).map((r) => [r.firm, r.citations ?? []]));

  const themes = rankedThemes.map((theme) => {
    const narrative = narrativeByName.get(theme.name.toLowerCase()) ?? {};
    const seen = new Set();
    const citations = [];
    for (const firm of theme.firmsInvolved) {
      for (const c of citationsByFirm.get(firm) ?? []) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        citations.push(c);
      }
    }
    return {
      ...theme,
      whatTheyAreSaying: narrative.whatTheyAreSaying ?? "",
      whyItMatters: narrative.whyItMatters ?? "",
      citations: citations.slice(0, 5)
    };
  });

  return { themes, memo: { title: parsed.memo.title ?? "Weekly VC Theme Brief", body: parsed.memo.body ?? "" } };
}
