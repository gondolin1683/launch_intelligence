import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  FileText,
  Link2,
  Radar,
  RadioTower,
  Search,
  TrendingUp
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import partnersData from "../data/partners.json";
import seedSignalsData from "../data/signals.json";
import themesData from "../data/themes.json";
import trackedAccountsData from "../data/trackedAccounts.json";
import { generatePartnerMemo } from "./lib/memo";
import { getLatestWeeklyMemo } from "./lib/weeklyMemo";
import type {
  Citation,
  Firm,
  PartnerAccount,
  Signal,
  TrackedAccount,
  VcTheme
} from "./lib/types";

// Read the latest memo from DynamoDB on every request (no build-time caching),
// so a freshly generated weekly memo shows up without a redeploy.
export const dynamic = "force-dynamic";

const seedSignals = seedSignalsData as Signal[];
const partners = partnersData as PartnerAccount[];
const trackedAccounts = trackedAccountsData as TrackedAccount[];
const seedThemes = (themesData as VcTheme[]).sort((a, b) => b.signalStrength - a.signalStrength);

// Unified shape the dashboard renders, whether data is live (generated) or seed.
type DisplayTheme = {
  name: string;
  signalStrength: number;
  firmsInvolved: Firm[];
  partnerSignalCount: number;
  signalCount: number;
  whatTheyAreSaying: string;
  whyItMatters: string;
  citations: Citation[];
};

const firmStyles: Record<Firm, string> = {
  a16z: "border-rose-200 bg-rose-50 text-rose-800",
  Sequoia: "border-emerald-200 bg-emerald-50 text-emerald-800",
  YC: "border-orange-200 bg-orange-50 text-orange-800"
};

function percentage(value: number) {
  return `${Math.max(8, Math.min(100, value))}%`;
}

function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(iso));
}

function SectionHeader({
  eyebrow,
  title,
  icon: Icon,
  note
}: {
  eyebrow: string;
  title: string;
  icon: typeof Radar;
  note?: string;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          <Icon className="h-4 w-4 text-teal-700" />
          {eyebrow}
        </div>
        <h2 className="text-2xl font-semibold text-zinc-950">{title}</h2>
      </div>
      {note ? <p className="max-w-xl text-sm leading-6 text-zinc-600">{note}</p> : null}
    </div>
  );
}

function FirmBadge({ firm }: { firm: Firm }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${firmStyles[firm]}`}>
      {firm}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-3 text-center">
      <div className="text-base font-bold text-zinc-950">{value}</div>
      <div className="text-[11px] font-medium text-zinc-500">{label}</div>
    </div>
  );
}

function countByFirm(items: Array<{ firm: Firm }>) {
  return items.reduce(
    (counts, item) => ({ ...counts, [item.firm]: counts[item.firm] + 1 }),
    { Sequoia: 0, a16z: 0, YC: 0 } satisfies Record<Firm, number>
  );
}

function ThemeCard({ theme, rank }: { theme: DisplayTheme; rank: number }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Rank #{rank}</div>
          <h3 className="text-xl font-semibold text-zinc-950">{theme.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {theme.firmsInvolved.map((firm) => (
              <FirmBadge firm={firm} key={firm} />
            ))}
          </div>
        </div>
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-950">
          <span className="text-2xl font-bold leading-none">{theme.signalStrength}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700">signal</span>
        </div>
      </div>

      <div className="mb-5 h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-teal-700" style={{ width: percentage(theme.signalStrength) }} />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <MiniMetric label="Partner signals" value={theme.partnerSignalCount} />
        <MiniMetric label="Firms" value={theme.firmsInvolved.length} />
        <MiniMetric label="Tweets" value={theme.signalCount} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">What they are saying</div>
          <p className="text-sm leading-6 text-zinc-700">{theme.whatTheyAreSaying}</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Why this matters</div>
          <p className="text-sm leading-6 text-zinc-700">{theme.whyItMatters}</p>
        </div>
      </div>

      {theme.citations.length > 0 ? (
        <div className="mt-5 border-t border-zinc-200 pt-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
            <Link2 className="h-4 w-4 text-teal-700" />
            Sources
          </div>
          <ul className="space-y-2">
            {theme.citations.map((citation) => (
              <li key={citation.url}>
                <a
                  className="inline-flex items-start gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950"
                  href={citation.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="leading-5">{citation.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default async function Home() {
  const weekly = await getLatestWeeklyMemo();
  const liveMode = Boolean(weekly);

  const themes: DisplayTheme[] = liveMode
    ? [...weekly!.themes]
        .sort((a, b) => b.signalStrength - a.signalStrength)
        .map((t) => ({
          name: t.name,
          signalStrength: t.signalStrength,
          firmsInvolved: t.firmsInvolved,
          partnerSignalCount: t.partnerSignalCount,
          signalCount: t.signalCount,
          whatTheyAreSaying: t.whatTheyAreSaying,
          whyItMatters: t.whyItMatters,
          citations: t.citations ?? []
        }))
    : seedThemes.map((t) => ({
        name: t.name,
        signalStrength: t.signalStrength,
        firmsInvolved: t.firmsInvolved,
        partnerSignalCount: t.partnerSignalCount,
        signalCount: t.investmentActivityCount,
        whatTheyAreSaying: t.whatTheyAreSaying,
        whyItMatters: t.whyItMatters,
        citations: []
      }));

  const topTheme = themes[0];
  const partnerCounts = countByFirm(partners);
  const firmsTracked = new Set(trackedAccounts.map((account) => account.firm)).size;
  const totalSources = themes.reduce((total, theme) => total + theme.citations.length, 0);

  const memoTitle = liveMode ? weekly!.memo.title : "Weekly VC Theme Brief";
  const memoBody = liveMode ? weekly!.memo.body : null;
  const seedMemoParagraphs = liveMode ? [] : generatePartnerMemo(seedThemes, seedSignals);
  const generatedAt = liveMode ? weekly!.meta.generatedAt : null;

  return (
    <main className="min-h-screen">
      <section className="border-b border-black/10 bg-[#102a2a] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-teal-50">
              <Radar className="h-4 w-4" />
              VC Theme Intelligence · Monday briefing
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-white lg:text-6xl">
              What elite VCs are focused on right now.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-teal-50/85">
              Venture Radar turns public signals from Sequoia, a16z, YC, and their partners into ranked investable themes with evidence-backed synthesis for LAUNCH.
            </p>
          </div>

          <div className="grid content-end gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-white/15 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-teal-50/75">Highest-conviction theme</span>
                <TrendingUp className="h-5 w-5 text-amber-200" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{topTheme.name}</div>
              <div className="mt-3 h-2 rounded-full bg-white/15">
                <div className="h-2 rounded-full bg-amber-300" style={{ width: percentage(topTheme.signalStrength) }} />
              </div>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-teal-50/75">Data mode</span>
                <RadioTower className="h-5 w-5 text-cyan-200" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{liveMode ? "Live synthesis" : "Seed briefing"}</div>
              <p className="mt-1 text-sm text-teal-50/75">
                {liveMode
                  ? `${weekly!.meta.model}${weekly!.meta.webGrounded ? " · web-grounded" : ""}`
                  : `${trackedAccounts.length} partner X accounts · ${firmsTracked} firms`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <section className="mb-10">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-zinc-500">Ranked themes</div>
              <div className="mt-2 text-3xl font-bold text-zinc-950">{themes.length}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-zinc-500">Partner X accounts</div>
              <div className="mt-2 text-3xl font-bold text-zinc-950">{partners.length}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-zinc-500">{liveMode ? "Sources cited" : "Firms tracked"}</div>
              <div className="mt-2 text-3xl font-bold text-zinc-950">{liveMode ? totalSources : firmsTracked}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-zinc-500">Top signal strength</div>
              <div className="mt-2 text-3xl font-bold text-zinc-950">{topTheme.signalStrength}</div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <SectionHeader
            eyebrow="Tracked universe"
            icon={RadioTower}
            note="The real partner account map the product monitors with X API credentials. Handles are sourced from official firm and people pages."
            title="Tracked VC Partner Accounts"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {(["Sequoia", "a16z", "YC"] as Firm[]).map((firm) => (
              <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" key={firm}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <FirmBadge firm={firm} />
                  <span className="text-sm font-semibold text-zinc-500">{partnerCounts[firm]} accounts</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniMetric label="Partners" value={partnerCounts[firm]} />
                  <MiniMetric label="Theme focus" value={themes.filter((theme) => theme.firmsInvolved.includes(firm)).length} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {partners
                    .filter((partner) => partner.firm === firm)
                    .slice(0, 5)
                    .map((partner) => (
                      <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700" key={`${firm}-${partner.handle}`}>
                        @{partner.handle}
                      </span>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <SectionHeader
            eyebrow="Theme dashboard"
            icon={BarChart3}
            note="Ranked by signal strength: tweet volume, cross-firm validation, and partner chatter. Each theme links to the web sources that ground the synthesis."
            title="Ranked VC Themes"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {themes.map((theme, index) => (
              <ThemeCard key={theme.name} rank={index + 1} theme={theme} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader eyebrow="Memo output" title="Weekly Partner Memo" icon={FileText} />
          <article className="rounded-lg border border-zinc-200 bg-[#fffaf2] p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">
                  <BadgeCheck className="h-4 w-4" />
                  LAUNCH memo draft
                </div>
                <h3 className="mt-2 text-xl font-semibold text-zinc-950">{memoTitle}</h3>
              </div>
              {generatedAt ? (
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700">
                  <CalendarDays className="h-4 w-4 text-amber-700" />
                  {formatTimestamp(generatedAt)}
                </div>
              ) : null}
            </div>
            {memoBody ? (
              <div className="memo-body text-sm leading-7 text-zinc-800">
                <ReactMarkdown>{memoBody}</ReactMarkdown>
              </div>
            ) : (
              <div className="memo-body text-sm leading-7 text-zinc-800">
                {seedMemoParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </article>
        </section>

        {liveMode ? null : (
          <section className="mb-8">
            <SectionHeader
              eyebrow="Fallback"
              icon={Search}
              note="Live synthesis from DynamoDB is unavailable, so the dashboard is showing the seed briefing. Run the weekly summarization Lambda (or check AWS credentials) to populate live data."
              title="Showing seed data"
            />
          </section>
        )}
      </div>
    </main>
  );
}
