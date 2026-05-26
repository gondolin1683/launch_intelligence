export function distinctLabelCounts(classifiedTweets) {
  const counts = new Map();
  for (const t of classifiedTweets) {
    counts.set(t.theme, (counts.get(t.theme) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function applyConsolidation(classifiedTweets, mapping) {
  return classifiedTweets.map((t) => ({ ...t, theme: mapping[t.theme] ?? t.theme }));
}
