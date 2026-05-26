import seedSignals from "../../data/signals.json";
import trackedAccounts from "../../data/trackedAccounts.json";
import type { Signal, TrackedAccount } from "./types";

type XSearchResponse = {
  data?: Array<{
    id: string;
    text: string;
    created_at?: string;
    author_id?: string;
    public_metrics?: {
      like_count?: number;
      retweet_count?: number;
      reply_count?: number;
    };
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
  };
};

function inferTheme(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("robot") || normalized.includes("physical")) return "Robotics / Physical AI";
  if (normalized.includes("health") || normalized.includes("clinical") || normalized.includes("nurse")) return "Healthcare AI";
  if (normalized.includes("defense") || normalized.includes("autonomous systems")) return "Defense Tech";
  if (normalized.includes("dev") || normalized.includes("code") || normalized.includes("repo")) return "DevTools";
  if (normalized.includes("infra") || normalized.includes("eval") || normalized.includes("inference")) return "AI Infrastructure";
  if (normalized.includes("vertical") || normalized.includes("workflow")) return "Vertical AI";
  return "AI Agents";
}

function summarize(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 138 ? `${cleaned.slice(0, 135)}...` : cleaned;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function getSignalsWithOptionalXLiveMode(): Promise<{
  mode: "seed" | "live";
  signals: Signal[];
}> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const accounts = trackedAccounts as TrackedAccount[];

  if (!bearerToken) {
    return { mode: "seed", signals: seedSignals as Signal[] };
  }

  const uniqueAccounts = Array.from(
    new Map(
      accounts
        .filter((account) => account.platform === "X")
        .map((account) => [account.handle.toLowerCase(), account])
    ).values()
  );
  const accountBatches = chunk(uniqueAccounts, 8);
  const liveSignals: Signal[] = [];

  try {
    for (const batch of accountBatches) {
      const query = batch.map((account) => `from:${account.handle}`).join(" OR ");
      const url = new URL("https://api.x.com/2/tweets/search/recent");
      url.searchParams.set("query", `(${query}) -is:retweet lang:en`);
      url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id");
      url.searchParams.set("expansions", "author_id");
      url.searchParams.set("max_results", "20");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`
        },
        next: { revalidate: 900 }
      });

      if (!response.ok) continue;

      const payload = (await response.json()) as XSearchResponse;
      const usersById = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]));
      const accountByHandle = new Map(uniqueAccounts.map((account) => [account.handle.toLowerCase(), account]));

      payload.data?.forEach((tweet, index) => {
        const user = tweet.author_id ? usersById.get(tweet.author_id) : undefined;
        const account = user ? accountByHandle.get(user.username.toLowerCase()) : undefined;
        const theme = inferTheme(tweet.text);

        liveSignals.push({
          id: `live_${tweet.id}_${index}`,
          source: "X",
          firm: account?.firm ?? "YC",
          author: account?.name ?? user?.name ?? "Tracked Account",
          authorType: account?.type ?? "partner",
          content: tweet.text,
          summary: summarize(tweet.text),
          theme,
          publishedAt: tweet.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          url: user ? `https://x.com/${user.username}/status/${tweet.id}` : `https://x.com/i/status/${tweet.id}`,
          engagement: {
            likes: tweet.public_metrics?.like_count ?? 0,
            reposts: tweet.public_metrics?.retweet_count ?? 0,
            replies: tweet.public_metrics?.reply_count ?? 0
          },
          relevance: "Medium"
        });
      });
    }

    return liveSignals.length
      ? { mode: "live", signals: liveSignals }
      : { mode: "seed", signals: seedSignals as Signal[] };
  } catch {
    return { mode: "seed", signals: seedSignals as Signal[] };
  }
}
