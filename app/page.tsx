import { BadgeCheck, BarChart3, CalendarDays, Download, FileText, RadioTower, RefreshCw, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import partnersData from "../data/partners.json";
import seedSignalsData from "../data/signals.json";
import themesData from "../data/themes.json";
import { BackgroundEffects } from "./BackgroundEffects";
import { selectDealMemoTarget } from "./lib/dealMemo";
import { generatePartnerMemo } from "./lib/memo";
import { getLatestCompanyHighlight, getLatestWeeklyMemo } from "./lib/weeklyMemo";
import type { Firm, PartnerAccount, Signal, VcTheme } from "./lib/types";

// Read the latest memo from DynamoDB on every request (no build-time caching),
// so a freshly generated weekly memo shows up without a redeploy.
export const dynamic = "force-dynamic";

const seedSignals = seedSignalsData as Signal[];
const partners = partnersData as PartnerAccount[];
const seedThemes = (themesData as VcTheme[]).sort((a, b) => b.signalStrength - a.signalStrength);

type DisplayTheme = {
  name: string;
  signalStrength: number;
  firmsInvolved: Firm[];
  partnerSignalCount: number;
  signalCount: number;
  whatTheyAreSaying: string;
  whyItMatters: string;
};

const firmStyles: Record<Firm, string> = {
  a16z: "border-rose-400/30 text-rose-300",
  Sequoia: "border-emerald-400/30 text-emerald-300",
  YC: "border-orange-400/30 text-orange-300"
};

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
  icon: typeof RadioTower;
  note?: string;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          <Icon className="h-3.5 w-3.5 text-sky-400" />
          {eyebrow}
        </div>
        <h2 className="text-2xl font-medium uppercase tracking-[0.06em] text-white md:text-3xl">{title}</h2>
      </div>
      {note ? <p className="max-w-md text-sm leading-6 text-zinc-500">{note}</p> : null}
    </div>
  );
}

function FirmBadge({ firm }: { firm: Firm }) {
  return (
    <span className={`inline-flex items-center rounded-full border bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${firmStyles[firm]}`}>
      {firm}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-3xl font-medium text-white">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-3 text-center">
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</div>
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
    <article className="rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Rank #{rank}</div>
          <h3 className="text-lg font-medium text-white">{theme.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {theme.firmsInvolved.map((firm) => (
              <FirmBadge firm={firm} key={firm} />
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <MiniMetric label="Partner signals" value={theme.partnerSignalCount} />
        <MiniMetric label="Firms" value={theme.firmsInvolved.length} />
        <MiniMetric label="Tweets" value={theme.signalCount} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">What they are saying</div>
          <p className="text-sm leading-6 text-zinc-300">{theme.whatTheyAreSaying}</p>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Why this matters</div>
          <p className="text-sm leading-6 text-zinc-300">{theme.whyItMatters}</p>
        </div>
      </div>
    </article>
  );
}

export default async function Home() {
  const weekly = await getLatestWeeklyMemo();
  const companyHighlight = await getLatestCompanyHighlight(weekly?.weekKey);
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
          whyItMatters: t.whyItMatters
        }))
    : seedThemes.map((t) => ({
        name: t.name,
        signalStrength: t.signalStrength,
        firmsInvolved: t.firmsInvolved,
        partnerSignalCount: t.partnerSignalCount,
        signalCount: t.investmentActivityCount,
        whatTheyAreSaying: t.whatTheyAreSaying,
        whyItMatters: t.whyItMatters
      }));

  const partnerCounts = countByFirm(partners);
  const memoTitle = liveMode ? weekly!.memo.title : "Weekly VC Theme Brief";
  const memoBody = liveMode ? weekly!.memo.body : null;
  const seedMemoParagraphs = liveMode ? [] : generatePartnerMemo(seedThemes, seedSignals);
  const generatedAt = liveMode ? weekly!.meta.generatedAt : null;
  const dealMemoTarget = selectDealMemoTarget({
    companyHighlight,
    generatedAt,
    memoBody,
    themes,
    weekKey: liveMode ? weekly!.weekKey : "seed"
  });

  return (
    <main className="relative min-h-screen text-zinc-100">
      <BackgroundEffects />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="mb-12 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 pb-4 text-xs text-zinc-500">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span>Refreshes weekly — tweets ingested Mondays 14:00 UTC, themes and memo generated 14:30 UTC.</span>
          {generatedAt ? <span className="text-zinc-600">Last updated {formatTimestamp(generatedAt)}.</span> : null}
        </div>
        <section className="mb-20">
          <SectionHeader
            eyebrow="Tracked universe"
            icon={RadioTower}
            note="The real partner accounts the product monitors via the X API, grouped by firm."
            title="Tracked VC Partner Accounts"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {(["Sequoia", "a16z", "YC"] as Firm[]).map((firm) => (
              <article className="rounded-xl border border-white/10 bg-white/[0.02] p-6" key={firm}>
                <FirmBadge firm={firm} />
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <Stat label="Partners tracked" value={partnerCounts[firm]} />
                  <Stat label="Theme focus" value={themes.filter((theme) => theme.firmsInvolved.includes(firm)).length} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <SectionHeader eyebrow="Memo output" title="Weekly Partner Memo" icon={FileText} />
          <article className="rounded-xl border border-white/10 bg-white/[0.02] p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  LAUNCH memo draft
                </div>
                <h3 className="mt-2 text-lg font-medium text-white">{memoTitle}</h3>
              </div>
              {generatedAt ? (
                <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400">
                  <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
                  {formatTimestamp(generatedAt)}
                </div>
              ) : null}
            </div>
            {memoBody ? (
              <div className="memo-body text-sm leading-7 text-zinc-300">
                <ReactMarkdown>{memoBody}</ReactMarkdown>
              </div>
            ) : (
              <div className="memo-body text-sm leading-7 text-zinc-300">
                {seedMemoParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="mb-20">
          <SectionHeader
            eyebrow="Company highlight"
            icon={FileText}
            note="One seed or Series A company selected for fit against this week's partner memo themes."
            title="Weekly Company Highlight"
          />
          <article className="rounded-xl border border-white/10 bg-white/[0.02] p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {dealMemoTarget.candidate.stage} match
                </div>
                <h3 className="mt-2 text-2xl font-medium text-white">{dealMemoTarget.candidate.company}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{dealMemoTarget.candidate.category}</p>
              </div>
              <a
                className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-sky-200 transition-colors hover:border-sky-300/50 hover:bg-sky-300/15"
                download
                href="/api/deal-memo"
                title={`Generate deal memo for ${dealMemoTarget.candidate.company}`}
              >
                <Download className="h-3.5 w-3.5" />
                Generate deal memo
              </a>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Why it matches this week</div>
                <p className="text-sm leading-7 text-zinc-300">
                  {dealMemoTarget.candidate.thesis} This overlaps with the current memo themes around{" "}
                  {dealMemoTarget.matchedThemes.map((theme) => theme.name).join(", ")}.
                </p>
              </div>
              <div className="rounded-md border border-white/5 bg-white/[0.02] p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Matched themes</div>
                <div className="flex flex-wrap gap-2">
                  {dealMemoTarget.matchedThemes.map((theme) => (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300" key={theme.name}>
                      {theme.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="mb-20">
          <SectionHeader
            eyebrow="Theme dashboard"
            icon={BarChart3}
            note="Ranked by signal strength: tweet volume, cross-firm validation, and partner chatter."
            title="Ranked VC Themes"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {themes.map((theme, index) => (
              <ThemeCard key={theme.name} rank={index + 1} theme={theme} />
            ))}
          </div>
        </section>

        {liveMode ? null : (
          <section className="mt-12">
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
