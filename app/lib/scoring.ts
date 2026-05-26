import type { Firm, Opportunity, ScoredOpportunity, Signal, ThemeSummary } from "./types";

const themeRationales: Record<string, string> = {
  "AI Agents":
    "VCs are converging on agents that own measurable business workflows, creating wedge opportunities in operations-heavy markets.",
  "AI Infrastructure":
    "Agent adoption is exposing new infrastructure needs around inference cost, evals, observability, security, and orchestration.",
  "Vertical AI":
    "The strongest AI applications are moving into specific job functions where workflow ownership can compound into system-of-record value.",
  "Robotics / Physical AI":
    "Physical AI is shifting from lab capability to constrained production deployments, where data loops and customer pilots matter.",
  "Healthcare AI":
    "Healthcare buyers are looking for administrative relief and measurable outcomes, especially in clinical ops and revenue cycle work.",
  "Defense Tech":
    "Defense is behaving more like a software market, rewarding founders who combine product velocity with procurement fluency.",
  "DevTools":
    "AI developer tools with obvious ROI remain attractive as coding agents move from autocomplete into sustained repo ownership."
};

const launchFitByTheme: Record<string, number> = {
  "AI Agents": 94,
  "Vertical AI": 92,
  "DevTools": 88,
  "AI Infrastructure": 86,
  "Healthcare AI": 84,
  "Defense Tech": 78,
  "Robotics / Physical AI": 76
};

const firmOrder: Firm[] = ["Sequoia", "a16z", "YC"];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

export function buildThemeSummaries(signals: Signal[]): ThemeSummary[] {
  const byTheme = new Map<string, Signal[]>();

  signals.forEach((signal) => {
    byTheme.set(signal.theme, [...(byTheme.get(signal.theme) ?? []), signal]);
  });

  const maxSignals = Math.max(...Array.from(byTheme.values()).map((items) => items.length));

  return Array.from(byTheme.entries())
    .map(([theme, themeSignals]) => {
      const firms = Array.from(new Set(themeSignals.map((signal) => signal.firm))).sort(
        (a, b) => firmOrder.indexOf(a) - firmOrder.indexOf(b)
      );
      const partnerSignals = themeSignals.filter((signal) => signal.authorType === "partner").length;
      const founderSignals = themeSignals.filter((signal) => signal.authorType === "founder").length;
      const highRelevance = themeSignals.filter((signal) => signal.relevance === "High").length;
      const score = round(
        clamp(
          (themeSignals.length / maxSignals) * 34 +
            firms.length * 15 +
            partnerSignals * 7 +
            founderSignals * 4 +
            highRelevance * 3
        )
      );

      return {
        name: theme,
        score,
        firms,
        partnerSignals,
        founderSignals,
        signalCount: themeSignals.length,
        whyItMatters: themeRationales[theme] ?? "Signals are clustering into a repeatable venture research theme."
      };
    })
    .sort((a, b) => b.score - a.score);
}

function sourceQuality(opportunity: Opportunity, relatedSignals: Signal[]) {
  const source = opportunity.source.toLowerCase();
  const hasTopFirmPartner = relatedSignals.some(
    (signal) => signal.authorType === "partner" && ["a16z", "Sequoia", "YC"].includes(signal.firm)
  );
  const hasYcSignal = source.includes("yc") || relatedSignals.some((signal) => signal.source === "YC RFS");

  if (hasYcSignal || hasTopFirmPartner) return 94;
  if (relatedSignals.some((signal) => signal.source === "Company Blog")) return 82;
  if (source.includes("founder") || source.includes("product hunt")) return 68;
  return 56;
}

function startupActivity(relatedSignals: Signal[]) {
  const engagementTotal = relatedSignals.reduce(
    (total, signal) => total + signal.engagement.likes + signal.engagement.reposts * 3 + signal.engagement.replies * 2,
    0
  );
  const founderSignals = relatedSignals.filter((signal) => signal.authorType === "founder").length;

  return round(clamp(45 + relatedSignals.length * 7 + founderSignals * 8 + Math.log10(engagementTotal + 1) * 8));
}

function themeMomentum(opportunity: Opportunity, themeSummaries: ThemeSummary[]) {
  const matchingThemes = themeSummaries.filter((theme) => opportunity.relatedThemes.includes(theme.name));
  if (!matchingThemes.length) return 55;

  return round(
    matchingThemes.reduce((total, theme) => total + theme.score, 0) / matchingThemes.length
  );
}

function crossFirmValidation(relatedSignals: Signal[]) {
  const firmCount = new Set(relatedSignals.map((signal) => signal.firm)).size;
  return round(clamp(42 + firmCount * 19 + relatedSignals.length * 3));
}

function launchFit(opportunity: Opportunity) {
  const scores = opportunity.relatedThemes.map((theme) => launchFitByTheme[theme] ?? 72);
  return round(scores.reduce((total, value) => total + value, 0) / scores.length);
}

export function scoreOpportunities(
  opportunities: Opportunity[],
  signals: Signal[],
  themeSummaries: ThemeSummary[]
): ScoredOpportunity[] {
  return opportunities
    .map((opportunity) => {
      const relatedSignals = signals.filter((signal) => opportunity.relatedSignals.includes(signal.id));
      const breakdown = {
        themeMomentum: themeMomentum(opportunity, themeSummaries),
        sourceQuality: sourceQuality(opportunity, relatedSignals),
        startupActivity: startupActivity(relatedSignals),
        crossFirmValidation: crossFirmValidation(relatedSignals),
        launchFit: launchFit(opportunity)
      };
      const computedScore = round(
        breakdown.themeMomentum * 0.3 +
          breakdown.sourceQuality * 0.25 +
          breakdown.startupActivity * 0.2 +
          breakdown.crossFirmValidation * 0.15 +
          breakdown.launchFit * 0.1
      );

      return {
        ...opportunity,
        computedScore,
        scoreBreakdown: breakdown
      };
    })
    .sort((a, b) => b.computedScore - a.computedScore);
}
