export function buildMemoItems(result) {
  const base = {
    PK: `WEEK#${result.weekKey}`,
    entityType: "WEEKLY_MEMO",
    weekKey: result.weekKey,
    themes: result.themes,
    memo: result.memo,
    meta: result.meta
  };
  return [
    { ...base, SK: `SUMMARY#${result.meta.generatedAt}` },
    { ...base, SK: "SUMMARY#LATEST" }
  ];
}
