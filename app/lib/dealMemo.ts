import type { Firm } from "./types";

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
  memoBody?: string | null;
  themes: ThemeLike[];
  weekKey: string;
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

export function selectDealMemoTarget({ memoBody = "", themes, weekKey }: DealMemoInput): DealMemoTarget {
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

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
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

export function buildDealMemoPdf(input: DealMemoInput) {
  const lines = textToLines(buildDealMemoText(input));
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
