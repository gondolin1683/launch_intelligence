function inferTheme(text) {
  const n = (text ?? "").toLowerCase();
  if (n.includes("robot") || n.includes("physical")) return "Robotics / Physical AI";
  if (n.includes("health") || n.includes("clinical") || n.includes("nurse")) return "Healthcare AI";
  if (n.includes("defense") || n.includes("autonomous systems")) return "Defense Tech";
  if (n.includes("dev") || n.includes("code") || n.includes("repo")) return "DevTools";
  if (n.includes("infra") || n.includes("eval") || n.includes("inference")) return "AI Infrastructure";
  if (n.includes("vertical") || n.includes("workflow")) return "Vertical AI";
  return "AI Agents";
}

export function classifyByKeyword(tweets) {
  return tweets.map((t) => ({ ...t, theme: inferTheme(t.text), investmentRelevant: true }));
}

export function deterministicNarrative(themes) {
  return themes.map((theme) => ({
    ...theme,
    whatTheyAreSaying: `Partners across ${theme.firmsInvolved.join(", ")} are posting about ${theme.name}.`,
    whyItMatters: `${theme.name} drew ${theme.signalCount} partner signal(s) across ${theme.firmsInvolved.length} firm(s) this week.`,
    citations: []
  }));
}

export function deterministicMemo(themes) {
  const top = themes.slice(0, 3).map((theme) => theme.name).join(", ");
  return {
    title: "Weekly VC Theme Brief",
    body: `This week's highest-signal themes: ${top || "no themes detected"}.`
  };
}
