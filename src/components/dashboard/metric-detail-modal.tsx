'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type SleepEntry,
  ssColor, remColor, hrvColor, rhrColor, durationColor,
  ssTier, remTier, hrvTier, rhrTier, durTier,
  sleepDurationMin, fmtDuration, DUR_TARGET,
  lastNDays, personSex, rhrCutoffs,
} from '@/lib/sleep';
import { personalTrendNote } from '@/lib/coach';
import { fmtDate } from '@/lib/utils';
import { TeamChart } from '@/components/ui/team-chart';

export type MetricKey = 'ss' | 'rem' | 'hrv' | 'rhr' | 'dur';

interface MetricSpec {
  key: MetricKey;
  label: string;
  unit: string;
  target: number;
  higherBetter: boolean;
  color: (v: number | null) => string;
  tier: (v: number | null) => { label: string; color: string };
  /** Pull the metric value off an entry (or null when missing) */
  value: (e: SleepEntry) => number | null;
  /** Optional formatter for non-integer metrics (e.g. duration → "8h 49m"). */
  format?: (v: number | null) => string;
}

const SPECS: Record<MetricKey, MetricSpec> = {
  ss: {
    key: 'ss',
    label: 'Sleep Score',
    unit: '/100',
    target: 75,
    higherBetter: true,
    color: (v) => (v == null ? 'var(--color-fg-dim)' : ssColor(v)),
    tier: (v) => (v == null ? { label: '—', color: '#52525b' } : ssTier(v)),
    value: (e) => e.ss,
  },
  rem: {
    key: 'rem',
    label: 'REM',
    unit: 'min',
    target: 90,
    higherBetter: true,
    color: (v) => remColor(v),
    tier: (v) => remTier(v),
    value: (e) => e.rem,
  },
  hrv: {
    key: 'hrv',
    label: 'HRV',
    unit: 'ms',
    target: 45,
    higherBetter: true,
    color: (v) => hrvColor(v),
    tier: (v) => hrvTier(v),
    value: (e) => e.hrv,
  },
  rhr: {
    key: 'rhr',
    label: 'RHR',
    unit: 'bpm',
    target: 60,
    higherBetter: false,
    color: (v) => (v == null || v <= 0 ? 'var(--color-fg-dim)' : rhrColor(v)),
    tier: (v) => (v == null || v <= 0 ? { label: '—', color: '#52525b' } : rhrTier(v)),
    value: (e) => (e.rhr > 0 ? e.rhr : null),
  },
  dur: {
    key: 'dur',
    label: 'Durată',
    unit: '',
    target: DUR_TARGET,
    higherBetter: true,
    color: (v) => durationColor(v),
    tier: (v) => durTier(v),
    value: (e) => sleepDurationMin(e.start, e.end),
    format: (v) => fmtDuration(v),
  },
};

/**
 * Per-metric detail modal — opens when a KPI card is clicked.
 *
 * Layout: bottom-sheet on mobile, centered card on md+.
 * Sections (from top): header → headline + delta + target pill → 30d trend
 * chart with target line → 4 quick stats (avg 7d / avg 30d / best ever /
 * total logs) → full descending history list.
 *
 * The module is STATIC. Everything above "Toate măsurătorile" is pinned with
 * `shrink-0` and never moves; only the history rows scroll, inside their own
 * `flex-1 min-h-0 overflow-y-auto` box. `min-h-0` is load-bearing on both the
 * section and the list — a flex child defaults to `min-height:auto`, so without
 * it the list refuses to shrink, the scroll never engages, and the panel's
 * `overflow-hidden` silently clips rows off the bottom.
 */
const ORDER = Object.keys(SPECS) as MetricKey[];

export function MetricDetailModal({
  metric, entries, user, onClose, onNavigate,
}: {
  metric: MetricKey | null;
  entries: SleepEntry[];
  user: string;
  onClose: () => void;
  /** Jump to another metric without closing — enables ‹ › + pill nav + arrow keys */
  onNavigate?: (key: MetricKey) => void;
}) {
  // Lock scroll + listen for Escape / arrow-key navigation while open.
  useEffect(() => {
    if (!metric) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!onNavigate) return;
      const i = ORDER.indexOf(metric);
      if (e.key === 'ArrowRight') onNavigate(ORDER[(i + 1) % ORDER.length]);
      else if (e.key === 'ArrowLeft') onNavigate(ORDER[(i - 1 + ORDER.length) % ORDER.length]);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
  }, [metric, onClose, onNavigate]);

  // The static block is pinned, so whatever it takes, the history list does not
  // get. The chart is the only elastic thing in it, so it absorbs the squeeze —
  // but by how much can't be a constant: at phone width the header and the
  // headline row wrap, and the static block grows ~100px. So MEASURE it.
  //
  // `staticRest` deliberately excludes the chart's own box, which is what makes
  // this converge: the number we budget against doesn't move when the chart
  // resizes or disappears. One extra layout pass, no oscillation.
  const staticRef = useRef<HTMLDivElement>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState<number | null>(200);
  // Escape hatch: on a viewport too short to hold the static block AND a usable
  // list (a phone in landscape), pinning would leave a 25px scroll strip. There
  // the whole panel scrolls again — a cramped module beats an unusable one.
  const [cramped, setCramped] = useState(false);

  useLayoutEffect(() => {
    if (!metric) return;
    const measure = () => {
      const s = staticRef.current;
      const panel = s?.parentElement;
      const header = panel?.firstElementChild as HTMLElement | undefined;
      if (!s || !panel || !header) return;

      const LIST_MIN = 170;    // ~4 rows — the fewest that still reads as a list
      const LIST_CHROME = 55;  // the section's own label + padding
      const CHART_FRAME = 58;  // the chart's label, border and inner padding

      const staticRest = s.offsetHeight - (chartBoxRef.current?.offsetHeight ?? 0);
      const free = panel.clientHeight - header.offsetHeight - staticRest - LIST_CHROME;
      setCramped(prev => (prev === free < 110 ? prev : free < 110));

      const room = free - LIST_MIN;
      // Below ~80px there is no chart worth drawing — on a short screen the
      // numbers and the list win, and the chart steps aside.
      const next = room - CHART_FRAME < 80 ? null : Math.min(200, room - CHART_FRAME);
      setChartHeight(prev => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [metric, chartHeight]);

  // RHR thresholds are sex-calibrated — women's bands sit ~5 bpm higher.
  const sex = personSex(user);
  const spec = metric
    ? (metric === 'rhr'
        ? {
            ...SPECS.rhr,
            target: rhrCutoffs(sex)[1],
            color: (v: number | null) => (v == null || v <= 0 ? 'var(--color-fg-dim)' : rhrColor(v, sex)),
            tier: (v: number | null) => (v == null || v <= 0 ? { label: '—', color: '#52525b' } : rhrTier(v, sex)),
          }
        : SPECS[metric])
    : null;

  const stats = useMemo(() => {
    if (!spec) return null;
    const mine = entries
      .filter((e) => e.name === user)
      .sort((a, b) => a.date.localeCompare(b.date));
    const present = mine
      .map((e) => ({ date: e.date, v: spec.value(e) }))
      .filter((r): r is { date: string; v: number } => r.v != null);

    if (!present.length) {
      return { mine, present, last: null, prev: null, avg7: null, avg30: null, best: null };
    }

    const last = present[present.length - 1];
    const prev = present.length > 1 ? present[present.length - 2] : null;

    const within = (days: number) => {
      const win = lastNDays(
        mine.map((e) => ({ ...e })) as SleepEntry[],
        days,
      );
      const winVals = win
        .map((e) => spec.value(e))
        .filter((v): v is number => v != null);
      return winVals.length
        ? Math.round(winVals.reduce((s, v) => s + v, 0) / winVals.length)
        : null;
    };

    const avg7 = within(7);
    const avg30 = within(30);
    const best = spec.higherBetter
      ? Math.max(...present.map((p) => p.v))
      : Math.min(...present.map((p) => p.v));

    return { mine, present, last, prev, avg7, avg30, best };
  }, [entries, spec, user]);

  if (!metric || !spec || !stats) return null;

  const { present, last, prev, avg7, avg30, best } = stats;

  // Module navigation — cycle through metrics without closing.
  const curIdx = ORDER.indexOf(metric);
  const prevKey = ORDER[(curIdx - 1 + ORDER.length) % ORDER.length];
  const nextKey = ORDER[(curIdx + 1) % ORDER.length];

  // Build the 30-day chart series — use the same date axis density.
  const last30 = lastNDays(
    entries.filter((e) => e.name === user) as SleepEntry[],
    30,
  );
  const dates30 = [...new Set(last30.map((e) => e.date))].sort();
  const series30 = dates30.map((d) => {
    const e = last30.find((x) => x.date === d);
    return e ? spec.value(e) : null;
  });

  // Delta vs previous measurement, and target-vs-actual pill maths (same
  // shape as KpiCards so the UX feels consistent).
  const delta = last && prev ? last.v - prev.v : null;
  const deltaPositive = delta != null && (spec.higherBetter ? delta > 0 : delta < 0);
  const deltaNegative = delta != null && (spec.higherBetter ? delta < 0 : delta > 0);
  const deltaColor = deltaPositive
    ? 'var(--color-good)'
    : deltaNegative
    ? 'var(--color-bad)'
    : 'var(--color-fg-muted)';
  const deltaArrow = delta == null ? '·' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

  // Delta vs the very first measurement — long-arc progress (Shape pattern).
  const deltaStart = last && present.length > 1 ? last.v - present[0].v : null;
  const deltaStartGood = deltaStart != null && (spec.higherBetter ? deltaStart > 0 : deltaStart < 0);
  const deltaStartBad = deltaStart != null && (spec.higherBetter ? deltaStart < 0 : deltaStart > 0);
  const deltaStartColor = deltaStartGood
    ? 'var(--color-good)'
    : deltaStartBad
    ? 'var(--color-bad)'
    : 'var(--color-fg-muted)';
  const deltaStartArrow = deltaStart == null ? '·' : deltaStart > 0 ? '↑' : deltaStart < 0 ? '↓' : '→';

  const unitSuffix = spec.key === 'rem' || spec.key === 'dur' ? 'min' : '';
  /** Render a value through the spec's optional formatter (e.g. duration → "8h 49m"). */
  const renderVal = (v: number | null): string => spec.format ? spec.format(v) : (v == null ? '—' : String(v));

  // Deterministic narrative insight — the same holistic read shown on the
  // Personal History card, surfaced here too (Shape's getPersonInsight pattern).
  const trendNote = personalTrendNote(entries, user);
  const toneColor = trendNote?.tone === 'good'
    ? 'var(--color-good)'
    : trendNote?.tone === 'warn'
    ? 'var(--color-warn)'
    : 'var(--color-fg-muted)';

  const vsTarget = last
    ? spec.higherBetter ? last.v - spec.target : spec.target - last.v
    : null;
  const onTarget = vsTarget != null && vsTarget >= 0;
  const targetPillBg = vsTarget == null
    ? 'transparent'
    : onTarget
    ? 'color-mix(in srgb, var(--color-good) 14%, transparent)'
    : 'color-mix(in srgb, var(--color-bad) 14%, transparent)';
  const targetPillColor = vsTarget == null
    ? 'var(--color-fg-dim)'
    : onTarget
    ? 'var(--color-good)'
    : 'var(--color-bad)';

  const lastValue = last?.v ?? null;
  const valueColor = spec.color(lastValue);
  const lastTier = spec.tier(lastValue);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 fade-in-up"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`bg-[var(--color-bg)] w-full md:max-w-2xl max-h-[92vh] rounded-t-3xl md:rounded-2xl border border-[var(--color-border)] shadow-2xl shadow-black/50 flex flex-col ${
          cramped ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${spec.label} — detalii`}
      >
        {/* Header — pinned */}
        <header className="shrink-0 px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight">{spec.label}</h2>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: lastTier.color + '20', color: lastTier.color }}
                >
                  {lastTier.label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-fg-muted)] mt-1 num">
                target {spec.higherBetter ? '≥' : '≤'} {spec.target}{spec.unit}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onNavigate && (
                <>
                  <button
                    onClick={() => onNavigate(prevKey)}
                    aria-label="Modulul anterior"
                    className="tap w-9 h-9 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-xl leading-none"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => onNavigate(nextKey)}
                    aria-label="Modulul următor"
                    className="tap w-9 h-9 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-xl leading-none"
                  >
                    ›
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                aria-label="Închide"
                className="shrink-0 w-9 h-9 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Module switcher — jump straight to any metric */}
          {onNavigate && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto -mx-1 px-1 pb-0.5">
              {ORDER.map((k) => {
                const active = k === metric;
                return (
                  <button
                    key={k}
                    onClick={() => onNavigate(k)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors shrink-0"
                    style={active
                      ? { background: 'var(--color-accent)', color: 'var(--color-bg)' }
                      : { background: 'var(--color-surface)', color: 'var(--color-fg-muted)' }}
                  >
                    {SPECS[k].label}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Static block — pinned, never scrolls */}
        <div ref={staticRef} className="shrink-0 px-5 pt-4">
          {/* Headline + delta + target pill */}
          <div className="flex items-end justify-between gap-4 mb-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`num font-bold leading-none tracking-tight ${spec.format ? 'text-3xl' : 'text-4xl'}`}
                  style={{ color: valueColor }}
                >
                  {renderVal(lastValue)}
                </span>
                {spec.unit && <span className="text-sm text-[var(--color-fg-muted)] font-medium">{spec.unit}</span>}
              </div>
              <div className="text-[11px] num mt-1.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1" style={{ color: deltaColor }}>
                  <span aria-hidden>{deltaArrow}</span>
                  {delta != null ? (
                    <span>{spec.format ? spec.format(Math.abs(delta)) : `${Math.abs(delta)}${unitSuffix}`} vs ultima</span>
                  ) : (
                    <span className="text-[var(--color-fg-dim)]">prima măsurătoare</span>
                  )}
                </span>
                {deltaStart != null && (
                  <span className="flex items-center gap-1" style={{ color: deltaStartColor }}>
                    <span aria-hidden>{deltaStartArrow}</span>
                    <span>{spec.format ? spec.format(Math.abs(deltaStart)) : `${Math.abs(deltaStart)}${unitSuffix}`} de la start</span>
                  </span>
                )}
              </div>
            </div>
            {vsTarget != null && (
              <span
                className="num text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: targetPillBg, color: targetPillColor }}
              >
                {onTarget ? '+' : ''}{spec.format ? spec.format(Math.abs(vsTarget)) : vsTarget} {onTarget ? '✓ peste target' : 'sub target'}
              </span>
            )}
          </div>

          {/* Narrative insight — one line. The label above it was a second row of
              chrome for a word the colour already says. */}
          {trendNote && (
            <div
              className="mb-3 px-3 py-2 rounded-xl border flex items-center gap-2"
              style={{
                background: `color-mix(in srgb, ${toneColor} 9%, transparent)`,
                borderColor: `color-mix(in srgb, ${toneColor} 28%, transparent)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: toneColor }} aria-hidden />
              <span className="text-[13px] leading-snug text-[var(--color-fg)]">{trendNote.text}</span>
            </div>
          )}

          {/* 30-day trend chart — rich tooltip + crosshair (hover/touch) */}
          {present.length >= 2 && chartHeight != null && (
            <div ref={chartBoxRef} className="mb-3">
              <div className="label mb-1.5">Evoluție · ultimele 30 de zile</div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 pt-3 pb-2">
                <TeamChart
                  series={[{ name: spec.label, color: valueColor === 'var(--color-fg-dim)' ? '#a3e635' : valueColor, values: series30 }]}
                  dates={dates30}
                  height={chartHeight}
                  target={spec.target}
                  targetLabel="target"
                  unit={spec.key === 'ss' ? '' : spec.unit}
                  lowerBetter={!spec.higherBetter}
                  colorByTarget
                  fmt={spec.format}
                />
              </div>
            </div>
          )}

          {/* Quick stats grid */}
          <div className="grid grid-cols-4 gap-2">
            <StatCell label="medie 7z" value={avg7} unit={spec.unit} color={spec.color(avg7)} format={spec.format} />
            <StatCell label="medie 30z" value={avg30} unit={spec.unit} color={spec.color(avg30)} format={spec.format} />
            <StatCell label={spec.higherBetter ? 'best' : 'cel mai mic'} value={best} unit={spec.unit} color={spec.color(best)} format={spec.format} />
            <StatCell label="total loguri" value={present.length} unit="" color="var(--color-fg)" />
          </div>
        </div>

        {/* The ONLY scrolling region — the history rows. Label stays pinned above
            them so you always know what you're scrolling through. */}
        <div className={`px-5 pt-4 pb-4 ${cramped ? 'shrink-0' : 'flex-1 min-h-0 flex flex-col'}`}>
          <div className="label mb-2 shrink-0 flex items-baseline justify-between">
            <span>Toate măsurătorile</span>
            <span className="num text-[9px] normal-case tracking-normal font-normal text-[var(--color-fg-dim)]">{present.length}</span>
          </div>
          <div className={`space-y-1.5 pr-1 ${cramped ? '' : 'flex-1 min-h-0 overflow-y-auto'}`}>
            {[...present].reverse().map((p) => {
              const tier = spec.tier(p.v);
              return (
                <div
                  key={p.date}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: tier.color }}
                      aria-hidden
                    />
                    <span className="text-xs text-[var(--color-fg)] truncate">{fmtDate(p.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="num font-bold text-sm" style={{ color: spec.color(p.v) }}>
                      {spec.format ? spec.format(p.v) : p.v}{spec.unit && <span className="text-[10px] text-[var(--color-fg-dim)] font-normal ml-0.5">{spec.unit}</span>}
                    </span>
                  </div>
                </div>
              );
            })}
            {present.length === 0 && (
              <div className="text-xs text-[var(--color-fg-muted)] italic text-center py-6">
                Niciun log încă pentru această metrică.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, unit, color, format }: {
  label: string; value: number | null; unit: string; color: string;
  format?: (v: number | null) => string;
}) {
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="num font-bold text-sm leading-none" style={{ color: value == null ? 'var(--color-fg-dim)' : color }}>
        {format ? format(value) : (value ?? '—')}
      </div>
      <div className="text-[9px] text-[var(--color-fg-muted)] mt-0.5 leading-tight">{label}{unit ? ` · ${unit}` : ''}</div>
    </div>
  );
}
