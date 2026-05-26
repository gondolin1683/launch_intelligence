import type { Firm, Signal, VcTheme } from "./types";

export function generatePartnerMemo(
  themes: VcTheme[],
  signals: Signal[]
) {
  const topThemes = themes.slice(0, 3);
  const signalsById = new Map(signals.map((signal) => [signal.id, signal]));
  const themeEvidence = topThemes.map((theme) => {
    const evidence = theme.representativeSignals
      .map((id) => signalsById.get(id))
      .filter((signal): signal is Signal => Boolean(signal))
      .map((signal) => `${signal.firm} ${signal.authorType} signal from ${signal.author}`)
      .join("; ");

    return `${theme.name} has a ${theme.signalStrength} signal strength score across ${theme.firmsInvolved.join(
      ", "
    )}. What they are saying: ${theme.whatTheyAreSaying} Evidence: ${evidence}.`;
  });
  const firms: Firm[] = ["Sequoia", "a16z", "YC"];
  const firmFocus = firms
    .map((firm) => {
      const focus = topThemes
        .filter((theme) => theme.firmsInvolved.includes(firm))
        .map((theme) => theme.name)
        .join(", ");
      return focus ? `${firm}: ${focus}` : `${firm}: no top-three concentration this week`;
    })
    .join(" | ");
  return [
    `This week's VC Theme Intelligence read points to ${topThemes.map((theme) => theme.name).join(", ")} as the highest-conviction areas to watch for LAUNCH research.`,
    `Firm focus: ${firmFocus}.`,
    ...themeEvidence,
    `Why it matters for LAUNCH: these themes connect elite VC attention to seed-stage founder surfaces where LAUNCH can move early, especially workflow AI, production AI infrastructure, and vertical software with clear customer pain.`,
    `Recommended research priorities for next week: map active founders in the top three themes, review partner language for emerging category terms, identify YC batch overlap, and prepare a watchlist of companies that show customer pull before obvious fundraising momentum.`
  ];
}
