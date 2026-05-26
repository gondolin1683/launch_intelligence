export type Firm = "a16z" | "Sequoia" | "YC";

export type AuthorType = "partner" | "founder" | "firm";

export type Relevance = "High" | "Medium" | "Low";

export type Signal = {
  id: string;
  source: string;
  firm: Firm;
  author: string;
  authorType: AuthorType;
  content: string;
  summary: string;
  theme: string;
  publishedAt: string;
  url: string;
  engagement: {
    likes: number;
    reposts: number;
    replies: number;
  };
  relevance: Relevance;
};

export type Opportunity = {
  id: string;
  company: string;
  category: string;
  source: string;
  relatedThemes: string[];
  relatedSignals: string[];
  score: number;
  whyFlagged: string;
  recommendedAction: string;
};

export type TrackedAccount = {
  name: string;
  firm: Firm;
  handle: string;
  type: AuthorType;
  platform: string;
  role?: string;
  sourceUrl?: string;
  website?: string;
};

export type PartnerAccount = {
  name: string;
  firm: Firm;
  handle: string;
  role: string;
  platform: "X";
  sourceUrl: string;
};

export type VcTheme = {
  id: string;
  name: string;
  signalStrength: number;
  firmsInvolved: Firm[];
  partnerSignalCount: number;
  investmentActivityCount: number;
  whatTheyAreSaying: string;
  whyItMatters: string;
  representativeSignals: string[];
  relatedCompanies: string[];
};

export type Citation = {
  title: string;
  url: string;
};

// Shape stored in DynamoDB as WEEKLY_MEMO by the summarization Lambda.
export type GeneratedTheme = {
  name: string;
  signalStrength: number;
  firmsInvolved: Firm[];
  partnerSignalCount: number;
  signalCount: number;
  representativeTweetIds: string[];
  whatTheyAreSaying: string;
  whyItMatters: string;
  citations: Citation[];
};

export type WeeklyMemo = {
  title: string;
  body: string;
};

export type WeeklyMemoResult = {
  weekKey: string;
  themes: GeneratedTheme[];
  memo: WeeklyMemo;
  meta: {
    provider: string;
    model: string;
    generatedAt: string;
    mode: "llm" | "deterministic";
    webGrounded: boolean;
  };
};

export type ThemeSummary = {
  name: string;
  score: number;
  firms: Firm[];
  partnerSignals: number;
  founderSignals: number;
  signalCount: number;
  whyItMatters: string;
};

export type ScoredOpportunity = Opportunity & {
  computedScore: number;
  scoreBreakdown: {
    themeMomentum: number;
    sourceQuality: number;
    startupActivity: number;
    crossFirmValidation: number;
    launchFit: number;
  };
};
