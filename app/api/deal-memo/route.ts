import themesData from "../../../data/themes.json";
import { buildDealMemoPdf, generateDealMemoWithSonnet, selectDealMemoTarget } from "../../lib/dealMemo";
import type { VcTheme } from "../../lib/types";
import { getLatestCompanyHighlight, getLatestWeeklyMemo } from "../../lib/weeklyMemo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isoWeekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

export async function GET() {
  const weekly = await getLatestWeeklyMemo();
  const companyHighlight = await getLatestCompanyHighlight(weekly?.weekKey);
  const seedThemes = (themesData as VcTheme[]).map((theme) => ({
    name: theme.name,
    signalStrength: theme.signalStrength,
    firmsInvolved: theme.firmsInvolved,
    partnerSignalCount: theme.partnerSignalCount,
    signalCount: theme.investmentActivityCount,
    whatTheyAreSaying: theme.whatTheyAreSaying,
    whyItMatters: theme.whyItMatters
  }));

  const input = {
    companyHighlight,
    generatedAt: weekly?.meta.generatedAt ?? null,
    memoBody: weekly?.memo.body ?? null,
    themes: weekly?.themes ?? seedThemes,
    weekKey: weekly?.weekKey ?? isoWeekKey()
  };
  const target = selectDealMemoTarget(input);
  let generatedText: string | null = null;

  try {
    generatedText = await generateDealMemoWithSonnet(input);
  } catch (error) {
    console.error("[deal-memo] Sonnet generation failed, using deterministic PDF fallback:", error);
  }

  const pdf = buildDealMemoPdf(input, generatedText);
  const filename = `${target.candidate.slug}-deal-memo-${input.weekKey}.pdf`;

  return new Response(pdf, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf"
    }
  });
}
