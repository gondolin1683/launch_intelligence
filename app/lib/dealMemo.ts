import type { CompanyHighlightResult, Firm } from "./types";

type ThemeLike = {
  name: string;
  signalStrength: number;
  firmsInvolved?: Firm[];
  partnerSignalCount?: number;
  signalCount?: number;
  whatTheyAreSaying: string;
  whyItMatters: string;
};

type Competitor = {
  name: string;
  positioning: string;
  competitiveNote: string;
  url: string;
};

type DealMemoCandidate = {
  company: string;
  slug: string;
  website: string;
  stage: string;
  category: string;
  launchRelationship: string;
  tags: string[];
  description: string;
  traction: string;
  thesis: string;
  businessModel: string;
  keyRisks: string[];
  diligenceQuestions: string[];
  competitors: Competitor[];
  sources: Array<{ label: string; url: string }>;
};

export type DealMemoTarget = {
  candidate: DealMemoCandidate;
  matchedThemes: ThemeLike[];
  score: number;
};

export type DealMemoInput = {
  generatedAt?: string | null;
  companyHighlight?: CompanyHighlightResult | null;
  memoBody?: string | null;
  themes: ThemeLike[];
  weekKey: string;
};

export type CompanyHighlight = {
  company: string;
  category: string;
  description: string;
  matchReason: string;
  matchedThemes: string[];
  stage: string;
  website: string;
};

const dealMemoCandidates: DealMemoCandidate[] = [
  {
    company: "micro1",
    slug: "micro1",
    website: "https://www.micro1.ai",
    stage: "Series A",
    category: "AI human data, expert talent, and AI recruiting infrastructure",
    launchRelationship: "LAUNCH portfolio company",
    tags: [
      "ai infrastructure",
      "model economics",
      "future of work",
      "ai productivity",
      "ai agents",
      "human data",
      "ai training data",
      "ai recruiter",
      "talent",
      "evaluation",
      "frontier ai"
    ],
    description:
      "micro1 is building an AI platform for human intelligence, combining AI interviews, expert matching, performance data, and human data workflows for AI labs and enterprises.",
    traction:
      "The company announced a $35M Series A at a reported $500M valuation and describes its platform as serving frontier AI and enterprise data workflows.",
    thesis:
      "As AI models become cheaper and more capable, the scarce layer shifts toward high-quality human expertise, evaluation, and workflow-specific data. micro1 sits at that intersection: talent discovery, expert data production, and performance measurement.",
    businessModel:
      "Likely revenue streams include enterprise contracts for expert data, AI model evaluation, training-data operations, AI recruiting workflows, and talent marketplace take rates.",
    keyRisks: [
      "Human data markets can become procurement-driven and margin-compressed if buyers treat vendors as interchangeable labor pools.",
      "Large incumbents and well-funded challengers can compete aggressively on supply liquidity, customer access, and compliance.",
      "Quality control, worker trust, and task routing are operationally complex at scale.",
      "If frontier labs vertically integrate data operations, third-party platform demand could fragment."
    ],
    diligenceQuestions: [
      "What share of revenue is recurring enterprise platform usage versus services-heavy project work?",
      "How differentiated is micro1's expert graph, interview data, and performance telemetry versus competing talent/data networks?",
      "Which customer segments show the fastest expansion: AI labs, Fortune 100 enterprises, or software engineering hiring teams?",
      "What gross margin profile is achievable once expert payout, QA, and customer-success costs are fully loaded?",
      "Can the company turn human-data workflows into proprietary evaluation benchmarks or model-routing infrastructure?"
    ],
    competitors: [
      {
        name: "Scale AI",
        positioning: "Large incumbent in AI data labeling, data engine workflows, and enterprise AI infrastructure.",
        competitiveNote:
          "Scale is the category benchmark for enterprise AI data operations, but customer concentration and trust concerns can create openings for focused challengers.",
        url: "https://scale.com"
      },
      {
        name: "Mercor",
        positioning: "AI hiring and expert network platform that supplies domain experts for model training and evaluation.",
        competitiveNote:
          "Mercor competes closest on expert matching and AI interview-led supply acquisition, making supply quality and enterprise trust key differentiators.",
        url: "https://mercor.com"
      },
      {
        name: "Turing",
        positioning: "Global AI and engineering talent platform with services for AI data, coding, and enterprise delivery.",
        competitiveNote:
          "Turing brings a large talent network and enterprise footprint, but micro1 can differentiate through narrower focus on human intelligence data loops.",
        url: "https://www.turing.com"
      },
      {
        name: "Invisible Technologies",
        positioning: "AI training, operations, and workflow automation partner for enterprises.",
        competitiveNote:
          "Invisible competes for enterprise AI operations budgets; micro1's edge needs to come from expert-vetting data and talent-market depth.",
        url: "https://www.invisible.co"
      }
    ],
    sources: [
      { label: "micro1 website", url: "https://www.micro1.ai" },
      { label: "micro1 Series A announcement", url: "https://www.micro1.ai/series-a" },
      { label: "TechCrunch funding coverage", url: "https://techcrunch.com/2025/09/12/micro1-a-competitor-to-scale-ai-raises-funds-at-500m-valuation/" },
      { label: "LinkedIn company profile", url: "https://www.linkedin.com/company/micro1" },
      { label: "CB Insights competitor snapshot", url: "https://www.cbinsights.com/company/micro1/alternatives-competitors" }
    ]
  }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreTheme(candidate: DealMemoCandidate, theme: ThemeLike, memoBody: string) {
  const haystack = normalize(`${theme.name} ${theme.whatTheyAreSaying} ${theme.whyItMatters} ${memoBody}`);
  const matches = candidate.tags.filter((tag) => haystack.includes(normalize(tag)));
  const tokenMatches = candidate.tags.filter((tag) =>
    normalize(tag)
      .split(" ")
      .filter((token) => token.length > 3)
      .some((token) => haystack.includes(token))
  );

  return (matches.length * 16 + tokenMatches.length * 5) * Math.max(theme.signalStrength, 1);
}

function candidateFromHighlight(highlight: CompanyHighlightResult): DealMemoCandidate {
  return {
    company: highlight.company,
    slug: highlight.slug,
    website: highlight.website,
    stage: highlight.stage,
    category: highlight.category,
    launchRelationship: "Weekly LLM-selected company highlight",
    tags: [...highlight.matchedThemes, highlight.category, highlight.description],
    description: highlight.description,
    traction: highlight.knownDetails,
    thesis: highlight.whyMatchesMemo,
    businessModel: "Business model to be researched and verified in the generated memo.",
    keyRisks: ["Stage, traction, valuation, and customer claims should be verified against primary sources before any investment decision."],
    diligenceQuestions: [
      "What traction and revenue metrics are confirmed by primary or investor sources?",
      "How strong is founder-market fit versus better-funded competitors?",
      "What specific buyer pain creates budget urgency this year?",
      "What valuation and ownership profile would make this attractive for LAUNCH?",
      "Which claims remain unverified after public-source research?"
    ],
    competitors: highlight.competitors.map((competitor) => ({
      name: competitor.name,
      positioning: competitor.positioning,
      competitiveNote: competitor.positioning,
      url: competitor.url
    })),
    sources: highlight.sources.map((source) => ({ label: source.title, url: source.url }))
  };
}

export function selectDealMemoTarget({ companyHighlight, memoBody = "", themes, weekKey }: DealMemoInput): DealMemoTarget {
  if (companyHighlight) {
    const matched = themes.filter((theme) => companyHighlight.matchedThemes.some((name) => name.toLowerCase() === theme.name.toLowerCase()));
    return {
      candidate: candidateFromHighlight(companyHighlight),
      matchedThemes: matched.length ? matched : themes.slice(0, 3),
      score: Number.MAX_SAFE_INTEGER
    };
  }

  const ranked = dealMemoCandidates
    .map((candidate) => {
      const scoredThemes = themes
        .map((theme) => ({ theme, score: scoreTheme(candidate, theme, memoBody ?? "") }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      const score = scoredThemes.reduce((total, item) => total + item.score, 0) + (weekKey ? 1 : 0);

      return {
        candidate,
        matchedThemes: scoredThemes.slice(0, 3).map((item) => item.theme),
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0];
}

export function buildCompanyHighlight(input: DealMemoInput): CompanyHighlight {
  const target = selectDealMemoTarget(input);
  const { candidate } = target;
  const matchedThemes = target.matchedThemes.length ? target.matchedThemes : input.themes.slice(0, 3);
  const themeNames = matchedThemes.map((theme) => theme.name);

  return {
    company: candidate.company,
    category: candidate.category,
    description: candidate.description,
    matchReason: `${candidate.company} matches this week's partner memo because ${candidate.thesis} The strongest overlaps are ${themeNames.join(", ")}.`,
    matchedThemes: themeNames,
    stage: candidate.stage,
    website: candidate.website
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

export function buildDealMemoText(input: DealMemoInput) {
  const target = selectDealMemoTarget(input);
  const { candidate } = target;
  const matchedThemes = target.matchedThemes.length ? target.matchedThemes : input.themes.slice(0, 3);
  const themeSummary = matchedThemes.map((theme) => theme.name).join(", ");

  return [
    `Investment Deal Memo: ${candidate.company}`,
    `${candidate.stage} | ${candidate.category}`,
    `${candidate.launchRelationship} | Website: ${candidate.website}`,
    `Generated from partner memo week: ${input.weekKey}`,
    `Weekly memo generated at: ${formatDate(input.generatedAt)}`,
    "",
    "Recommendation",
    `Generate a partner-ready diligence memo on ${candidate.company}. The company is the closest current candidate to this week's memo themes: ${themeSummary}.`,
    "",
    "Company Snapshot",
    candidate.description,
    candidate.traction,
    "",
    "Why It Matches This Week's Themes",
    candidate.thesis,
    ...matchedThemes.map((theme) => `- ${theme.name}: ${theme.whyItMatters}`),
    "",
    "Business Model",
    candidate.businessModel,
    "",
    "Competitive Landscape",
    ...candidate.competitors.flatMap((competitor) => [
      `- ${competitor.name}: ${competitor.positioning}`,
      `  Competitive read: ${competitor.competitiveNote}`,
      `  URL: ${competitor.url}`
    ]),
    "",
    "Key Risks",
    ...candidate.keyRisks.map((risk) => `- ${risk}`),
    "",
    "Diligence Questions",
    ...candidate.diligenceQuestions.map((question) => `- ${question}`),
    "",
    "Suggested LAUNCH Next Steps",
    "- Confirm current customer mix, revenue run-rate quality, and gross margin profile.",
    "- Map AI lab, enterprise, and recruiting buyer segments separately; each has different sales cycles and margin structures.",
    "- Compare micro1 against Mercor, Scale AI, Turing, and Invisible on supply quality, customer trust, and workflow depth.",
    "- Decide whether this is primarily a portfolio-support memo, a follow-on memo, or a market-map memo for adjacent sourcing.",
    "",
    "Sources",
    ...candidate.sources.map((source) => `- ${source.label}: ${source.url}`),
    "",
    "Note",
    "This PDF is an automated first draft for investment discussion. It should be reviewed against primary diligence materials before use in an investment committee setting."
  ].join("\n");
}

export function buildDealMemoPrompt(input: DealMemoInput) {
  const target = selectDealMemoTarget(input);
  const { candidate } = target;
  const matchedThemes = target.matchedThemes.length ? target.matchedThemes : input.themes.slice(0, 3);
  const context = [
    candidate.thesis,
    "",
    "Matched weekly partner memo themes:",
    ...matchedThemes.map((theme) => `- ${theme.name}: ${theme.whyItMatters}`),
    "",
    "Weekly partner memo excerpt:",
    input.memoBody ?? "No live weekly memo body available; use the provided matched themes."
  ].join("\n");
  const knownDetails = [
    `Company: ${candidate.company}`,
    `Website: ${candidate.website}`,
    `LAUNCH relationship: ${candidate.launchRelationship}`,
    `Product/category: ${candidate.category}`,
    `Description: ${candidate.description}`,
    `Known traction/funding: ${candidate.traction}`,
    `Business model hypothesis: ${candidate.businessModel}`,
    `Known competitors: ${candidate.competitors.map((competitor) => `${competitor.name} (${competitor.url})`).join(", ")}`,
    `Starting sources: ${candidate.sources.map((source) => `${source.label}: ${source.url}`).join("; ")}`
  ].join("\n");

  return `You are an investment analyst creating a polished venture capital deal memo PDF for a startup investment opportunity.

Goal:
Generate a clear, detailed, visually rich PDF deal memo that helps an investment committee decide whether to invest in the startup.

Startup to analyze:
${candidate.company}

Context / thesis:
${context}

Known company details:
${knownDetails}

Investment stage:
${candidate.stage}

Target audience:
VC partners and investment committee members. The memo should be professional, skeptical, evidence-based, and easy to scan.

Important requirements:
1. The final output must be a PDF.
2. The PDF should include plenty of relevant images, including company logo, product screenshots, founder photos, market diagrams, competitor logos, charts, and visual summaries where available.
3. Do not use filler images. Every image should clarify the company, market, product, competition, or investment thesis.
4. Cite sources throughout the memo using footnotes or endnotes.
5. Clearly separate facts, assumptions, and investor interpretation.
6. Be honest about uncertainty. If information is not publicly available, say so and make a reasonable estimate only when clearly labeled.
7. Use a clean VC-style design with strong headings, charts, tables, and callout boxes.
8. Make the memo detailed enough for serious review, but structured enough that a partner can skim it in under 5 minutes.

Structure the PDF like this:

Page 1: Cover Page
- Startup name
- One-line description
- Logo and strong hero image/product screenshot
- Recommended action: Invest / Pass / Watchlist / Needs More Diligence
- Proposed round and estimated valuation, if available
- Date prepared

Page 2: Executive Summary
- 5 to 7 bullet summary of the opportunity
- Investment recommendation
- Core thesis
- Biggest upside case
- Biggest risk
- Key diligence questions
- Simple scorecard: Team, Market, Product, Traction, Timing, Competition, Valuation

Page 3: Company Overview
- What the company does
- Who the customer is
- Current product
- Business model
- Stage of company
- Founding story
- Relevant images: logo, website screenshot, product screenshot, founder image

Page 4: Market Opportunity
- Define the market
- TAM / SAM / SOM estimates
- Why now
- Key market tailwinds
- Market size chart
- Relevant industry data
- Explain why this market can support a venture-scale outcome

Page 5: Product and Technology
- Product workflow
- Core technical insight
- Why the product is hard to copy
- AI/data/model/infrastructure advantage, if applicable
- Product screenshots or architecture diagram
- Explain the product in simple language for nontechnical investors

Page 6: Customer Pain and Use Case
- What urgent problem the startup solves
- Current alternatives and why they are insufficient
- Buyer persona
- User persona
- Budget owner
- Pain severity
- Frequency of use
- Willingness to pay
- Include a visual user journey or before/after workflow

Page 7: Traction
- Revenue, users, pilots, customers, growth, retention, usage, waitlist, partnerships, or GitHub/developer traction if available
- Separate confirmed traction from inferred traction
- Include charts wherever possible
- Include logos of customers or partners only if publicly confirmed

Page 8: Competitive Landscape
- Direct competitors
- Indirect competitors
- Incumbents
- Open-source alternatives
- Competitive positioning matrix
- Explain why this startup can win
- Include competitor logos and a 2x2 positioning chart

Page 9: Business Model and Go-to-Market
- Pricing model
- Sales motion
- Customer acquisition strategy
- Expansion strategy
- Expected gross margins
- Sales cycle
- Near-term GTM risks
- Include a funnel diagram or GTM motion graphic

Page 10: Team
- Founder backgrounds
- Founder-market fit
- Prior exits, technical depth, domain expertise, or unusual insight
- Hiring gaps
- Include founder photos and short bios
- Be skeptical: explain what the team has proven and what remains unproven

Page 11: Financing and Round Analysis
- Prior funding history
- Likely current round
- Estimated amount being raised
- Estimated valuation range, if available or inferable
- Existing investors
- Why they may be raising now
- Use comparable rounds if direct data is unavailable
- Clearly label any assumptions

Page 12: Investment Thesis
- 3 to 5 strongest reasons to invest
- Why this company fits the current market moment
- Why this could become a large company
- What has to go right
- What would make this a category-defining startup

Page 13: Risks and Diligence Questions
- Product risk
- Market risk
- GTM risk
- Technical risk
- Team risk
- Financing risk
- Regulatory risk, if relevant
- For each risk, include mitigation or diligence needed
- Add a table: Risk / Severity / Evidence / Diligence Question / Mitigation

Page 14: Return Scenario Analysis
- Base case
- Upside case
- Downside case
- Potential exit paths
- Comparable company outcomes
- Ownership assumptions
- Rough fund-return potential
- Include a simple scenario table

Page 15: Final Recommendation
- Invest / Pass / Watchlist / Needs More Diligence
- Recommended check size
- Suggested ownership target
- Valuation sensitivity
- Diligence required before committing
- 3 strongest reasons to do the deal
- 3 strongest reasons to be cautious

Design requirements:
- Use a clean modern layout similar to a VC memo or strategy consulting deck.
- Use charts, tables, icons, callout boxes, and visuals.
- Use a consistent color palette based on the startup's brand colors.
- Keep pages visually balanced, not text-heavy.
- Use concise bullets, but include enough detail to support the investment recommendation.
- Include citations in a neat source section at the end or as footnotes.
- Add an appendix with extra research, source links, screenshots, and assumptions.

Research requirements:
- Search the web for current information.
- Use primary sources first: company website, founder LinkedIn, GitHub, press releases, SEC filings, investor announcements, customer case studies.
- Use reputable secondary sources: Crunchbase, PitchBook if available, TechCrunch, Forbes, BusinessWire, PRNewswire, The Information, Fortune, company blogs, investor blogs.
- Do not rely on outdated information if newer information exists.
- Verify funding dates, investors, product claims, and customer claims.
- If a claim cannot be verified, label it as unverified.

Output:
Create the final PDF content and provide a short written summary with:
- Recommendation
- Core thesis
- Biggest risk
- Top 5 diligence questions

Return only memo-ready text. Use clear page headings, compact bullets, source URLs, and visual/table descriptions that can be rendered into a PDF.`;
}

function textOfAnthropicContent(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && typeof block === "object" && "type" in block && block.type === "text" && "text" in block)
    .map((block) => String(block.text))
    .join("");
}

async function sha256Hex(value: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function hmac(key: Buffer | string, value: string) {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", key).update(value, "utf8").digest();
}

async function hmacHex(key: Buffer | string, value: string) {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

async function getAwsSecret(secretId: string) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;

  const region = process.env.AWS_REGION ?? "us-east-1";
  const service = "secretsmanager";
  const host = `${service}.${region}.amazonaws.com`;
  const target = "secretsmanager.GetSecretValue";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const body = JSON.stringify({ SecretId: secretId });
  const payloadHash = await sha256Hex(body);
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const canonicalHeaders = [
    "content-type:application/x-amz-json-1.1",
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    sessionToken ? `x-amz-security-token:${sessionToken}` : null,
    `x-amz-target:${target}`
  ].filter(Boolean) as string[];
  const signedHeaders = ["content-type", "host", "x-amz-date", sessionToken ? "x-amz-security-token" : null, "x-amz-target"]
    .filter(Boolean)
    .join(";");
  const canonicalRequest = ["POST", "/", "", `${canonicalHeaders.join("\n")}\n`, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = await hmac(dateKey, region);
  const dateRegionServiceKey = await hmac(dateRegionKey, service);
  const signingKey = await hmac(dateRegionServiceKey, "aws4_request");
  const signature = await hmacHex(signingKey, stringToSign);

  const response = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Date": amzDate,
      ...(sessionToken ? { "X-Amz-Security-Token": sessionToken } : {}),
      "X-Amz-Target": target
    },
    body
  });

  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload.SecretString === "string" ? payload.SecretString : null;
}

async function getAnthropicCredentials() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (apiKey) {
    return {
      apiKey,
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
    };
  }

  const inlineSecret = process.env.LLM_CREDENTIALS_JSON;
  if (inlineSecret) {
    const parsed = JSON.parse(inlineSecret);
    return {
      apiKey: parsed.apiKey ?? parsed.ANTHROPIC_API_KEY ?? parsed.token,
      model: parsed.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
    };
  }

  const secretId = process.env.LLM_CREDENTIALS_SECRET_NAME ?? process.env.OWNER_LLM_SECRET_NAME ?? "venture-radar/owner-llm-credentials";
  const secret = await getAwsSecret(secretId);
  if (!secret) return null;
  const parsed = JSON.parse(secret);
  const secretApiKey = parsed.apiKey ?? parsed.ANTHROPIC_API_KEY ?? parsed.token;
  if (!secretApiKey) return null;

  return {
    apiKey: secretApiKey,
    model: parsed.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
  };
}

export async function generateDealMemoWithSonnet(input: DealMemoInput) {
  const credentials = await getAnthropicCredentials();
  if (!credentials?.apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": credentials.apiKey
    },
    body: JSON.stringify({
      max_tokens: 12000,
      messages: [{ role: "user", content: buildDealMemoPrompt(input) }],
      model: credentials.model,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Sonnet deal memo generation failed: ${response.status} ${detail.slice(0, 200)}`);
  }

  const payload = await response.json();
  const text = textOfAnthropicContent(payload.content).trim();
  return text || null;
}

function cleanPdfText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
}

function escapePdfString(value: string) {
  return cleanPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  if (!text.trim()) return [""];

  const words = cleanPdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

type PdfLine = {
  color?: "blue" | "gray" | "black";
  fontSize: number;
  text: string;
};

function textToLines(text: string): PdfLine[] {
  const lines: PdfLine[] = [];
  const source = text.split("\n");

  source.forEach((line, index) => {
    const fontSize = index === 0 ? 18 : index === 1 ? 11 : /^[A-Z][A-Za-z ]+$/.test(line) ? 13 : 10;
    const color = index === 0 ? "blue" : index < 4 ? "gray" : "black";
    const maxChars = fontSize >= 18 ? 48 : fontSize >= 13 ? 62 : 86;
    wrapText(line, maxChars).forEach((wrapped) => lines.push({ color, fontSize, text: wrapped }));

    if (!line.trim()) {
      lines.push({ fontSize: 5, text: "" });
    }
  });

  return lines;
}

function lineColor(color: PdfLine["color"]) {
  if (color === "blue") return "0.05 0.42 0.62 rg";
  if (color === "gray") return "0.30 0.33 0.38 rg";
  return "0.06 0.06 0.07 rg";
}

export function buildPdfFromText(text: string) {
  const lines = textToLines(text);
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 54;
  const marginBottom = 56;
  const pageContents: string[] = [];
  let pageOps: string[] = [];
  let y = 736;

  const finishPage = () => {
    pageContents.push(pageOps.join("\n"));
    pageOps = [];
    y = 736;
  };

  for (const line of lines) {
    const lineHeight = Math.max(line.fontSize + 5, 12);
    if (y - lineHeight < marginBottom) {
      finishPage();
    }

    if (line.text) {
      pageOps.push("BT");
      pageOps.push(lineColor(line.color));
      pageOps.push(`/F1 ${line.fontSize} Tf`);
      pageOps.push(`1 0 0 1 ${marginX} ${y} Tm`);
      pageOps.push(`(${escapePdfString(line.text)}) Tj`);
      pageOps.push("ET");
    }

    y -= lineHeight;
  }

  finishPage();

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  const pageObjectIds: number[] = [];
  let nextObjectId = 4;

  pageContents.forEach((content) => {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    pageObjectIds.push(pageObjectId);

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function buildDealMemoPdf(input: DealMemoInput, generatedText?: string | null) {
  return buildPdfFromText(generatedText || buildDealMemoText(input));
}
