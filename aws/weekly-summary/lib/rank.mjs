const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function rankThemes(classifiedTweets, { representativeLimit = 3 } = {}) {
  const byTheme = new Map();
  for (const tweet of classifiedTweets) {
    const group = byTheme.get(tweet.theme) ?? [];
    group.push(tweet);
    byTheme.set(tweet.theme, group);
  }

  const maxSignals = Math.max(1, ...[...byTheme.values()].map((g) => g.length));

  return [...byTheme.entries()]
    .map(([name, tweets]) => {
      const firmsInvolved = [...new Set(tweets.map((t) => t.firm))];
      const partnerSignalCount = tweets.filter((t) => t.authorType === "partner").length;
      const representativeTweetIds = [...tweets]
        .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
        .slice(0, representativeLimit)
        .map((t) => t.tweetId);

      const signalStrength = Math.round(
        clamp(
          (tweets.length / maxSignals) * 34 +
            firmsInvolved.length * 15 +
            partnerSignalCount * 7
        )
      );

      return {
        name,
        signalStrength,
        firmsInvolved,
        partnerSignalCount,
        signalCount: tweets.length,
        representativeTweetIds
      };
    })
    .sort((a, b) => b.signalStrength - a.signalStrength);
}
