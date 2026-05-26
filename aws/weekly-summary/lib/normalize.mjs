export function ddbItemToTweet(item) {
  const pm = item.publicMetrics ?? {};
  return {
    tweetId: item.tweetId,
    firm: item.firm,
    authorType: item.authorType,
    text: item.text,
    engagement: (pm.like_count ?? 0) + (pm.retweet_count ?? 0) + (pm.reply_count ?? 0)
  };
}

function startOfIsoWeek(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

export function isoWeekKey(date = new Date()) {
  return startOfIsoWeek(date).toISOString().slice(0, 10);
}
