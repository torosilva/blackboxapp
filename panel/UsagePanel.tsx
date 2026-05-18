/**
 * UsagePanel — admin cost dashboard for BLACKBOX MIND.
 *
 * Drop this file into your blackbox-landing app (e.g. src/UsagePanel.tsx) and
 * render it on a route that is ALREADY behind your existing login.
 *
 * It reuses the logged-in Supabase session you already have. Pass your
 * existing authenticated supabase client as the `supabase` prop:
 *
 *   import { supabase } from './supabaseClient';
 *   <UsagePanel supabase={supabase} />
 *
 * Requirements:
 *  - Migration 20260518_usage_events.sql applied.
 *  - Your account promoted to admin:
 *      UPDATE public.profiles SET is_admin = true WHERE email = 'tu-correo';
 *  - The logged-in user is that admin (the RPC rejects non-admins).
 *
 * Zero extra dependencies — pure React + inline styles.
 */
import { useEffect, useMemo, useState } from 'react';

type SupabaseLike = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

interface ComponentRow {
  component: string;
  cost: number;
  events: number;
  pct: number;
}
interface UserRow {
  user_id: string | null;
  email: string | null;
  cost: number;
  events: number;
}
interface DayRow {
  day: string;
  cost: number;
}
interface Overview {
  from: string;
  to: string;
  total_cost: number;
  event_count: number;
  active_users: number;
  by_component: ComponentRow[];
  top_users: UserRow[];
  daily: DayRow[];
}

const COMPONENT_LABELS: Record<string, string> = {
  ai_chat: 'Chat IA',
  image_vision: 'Visión / imagen',
  entry_analysis: 'Análisis de entrada',
  pattern_synthesis: 'Síntesis de patrones',
  thread_classification: 'Clasificación de chat',
  weekly_report: 'Reporte semanal',
  transcription: 'Transcripción de voz',
  embedding: 'Embeddings',
  semantic_search: 'Búsqueda semántica',
};

const COLORS = [
  '#6366f1', '#a855f7', '#38bdf8', '#10b981',
  '#facc15', '#f43f5e', '#fb923c', '#22d3ee', '#94a3b8',
];

const RANGES = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

const usd = (n: number) =>
  '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function UsagePanel({ supabase }: { supabase: SupabaseLike }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    supabase
      .rpc('admin_usage_overview', { p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setData(data as Overview);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, supabase]);

  const maxDaily = useMemo(
    () => Math.max(1, ...(data?.daily ?? []).map((d) => d.cost)),
    [data]
  );

  const S = styles;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.headerRow}>
          <div>
            <div style={S.badge}>PANEL DE CONSUMO</div>
            <h1 style={S.h1}>Costo por usuario y componente</h1>
          </div>
          <div style={S.rangeGroup}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                style={{ ...S.rangeBtn, ...(days === r.days ? S.rangeBtnActive : {}) }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div style={S.muted}>Cargando…</div>}
        {error && (
          <div style={S.errorBox}>
            {error.includes('not authorized')
              ? 'Tu cuenta no es admin. Marca is_admin = true en tu perfil de Supabase.'
              : 'Error: ' + error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div style={S.kpis}>
              <div style={S.kpi}>
                <div style={S.kpiLabel}>Costo total</div>
                <div style={S.kpiValue}>{usd(data.total_cost)}</div>
              </div>
              <div style={S.kpi}>
                <div style={S.kpiLabel}>Usuarios activos</div>
                <div style={S.kpiValue}>{data.active_users}</div>
              </div>
              <div style={S.kpi}>
                <div style={S.kpiLabel}>Llamadas</div>
                <div style={S.kpiValue}>{data.event_count.toLocaleString()}</div>
              </div>
              <div style={S.kpi}>
                <div style={S.kpiLabel}>Costo / usuario</div>
                <div style={S.kpiValue}>
                  {usd(data.active_users ? data.total_cost / data.active_users : 0)}
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>QUÉ COMPONENTE CONSUME MÁS</div>
              {data.by_component.length === 0 && (
                <div style={S.muted}>Sin datos en este período.</div>
              )}
              {data.by_component.map((c, i) => (
                <div key={c.component} style={{ marginBottom: 14 }}>
                  <div style={S.barHead}>
                    <span>
                      <span
                        style={{
                          ...S.dot,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                      {COMPONENT_LABELS[c.component] ?? c.component}
                      <span style={S.barSub}> · {c.events} llamadas</span>
                    </span>
                    <span style={S.barVal}>
                      {usd(c.cost)} <span style={S.barSub}>({c.pct}%)</span>
                    </span>
                  </div>
                  <div style={S.barTrack}>
                    <div
                      style={{
                        ...S.barFill,
                        width: `${Math.max(2, c.pct)}%`,
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>TENDENCIA DIARIA</div>
              <div style={S.chart}>
                {data.daily.length === 0 && <div style={S.muted}>Sin datos.</div>}
                {data.daily.map((d) => (
                  <div key={d.day} style={S.chartCol} title={`${d.day}: ${usd(d.cost)}`}>
                    <div
                      style={{
                        ...S.chartBar,
                        height: `${Math.max(3, (d.cost / maxDaily) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>TOP USUARIOS POR COSTO</div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Usuario</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Llamadas</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Costo</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_users.map((u) => (
                    <tr key={u.user_id ?? 'anon'}>
                      <td style={S.td}>{u.email ?? u.user_id ?? '(sin atribuir)'}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{u.events}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>{usd(u.cost)}</td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        {data.total_cost > 0
                          ? ((100 * u.cost) / data.total_cost).toFixed(1)
                          : '0'}
                        %
                      </td>
                    </tr>
                  ))}
                  {data.top_users.length === 0 && (
                    <tr>
                      <td style={S.td} colSpan={4}>
                        Sin datos en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={S.foot}>
              Costos estimados con la tabla de precios de _shared/usage.ts ·
              Período: {new Date(data.from).toLocaleDateString()} –{' '}
              {new Date(data.to).toLocaleDateString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { background: '#020617', minHeight: '100vh', padding: '32px 16px', color: '#e2e8f0' },
  wrap: { maxWidth: 920, margin: '0 auto', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 26 },
  badge: { color: '#818cf8', fontSize: 12, fontWeight: 800, letterSpacing: 3 },
  h1: { fontSize: 26, fontWeight: 800, margin: '6px 0 0', color: '#fff' },
  rangeGroup: { display: 'flex', gap: 8 },
  rangeBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  rangeBtnActive: { background: '#6366f1', borderColor: '#6366f1', color: '#fff' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 22 },
  kpi: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 16, padding: 18 },
  kpiLabel: { color: '#818cf8', fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' },
  kpiValue: { fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 8 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 18 },
  cardTitle: { color: '#6366f1', fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 18 },
  barHead: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#cbd5e1', marginBottom: 6 },
  barSub: { color: '#64748b', fontWeight: 400 },
  barVal: { color: '#e2e8f0', fontWeight: 700 },
  barTrack: { background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  dot: { display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 },
  chartCol: { flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' },
  chartBar: { width: '100%', background: '#6366f1', borderRadius: '3px 3px 0 0', minHeight: 3 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', color: '#64748b', fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '0 0 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td: { padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' },
  muted: { color: '#64748b', fontSize: 14, padding: '8px 0' },
  errorBox: { background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fda4af', padding: 16, borderRadius: 12, fontSize: 14 },
  foot: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 24 },
};
