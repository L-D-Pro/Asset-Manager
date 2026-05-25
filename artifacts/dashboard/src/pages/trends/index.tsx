const SALARY_DATA = [
  { title: "Product Designer", median: 148, p25: 120, p75: 178, growth: "+11%", count: "412" },
  { title: "Senior UX Designer", median: 162, p25: 138, p75: 195, growth: "+8%", count: "287" },
  { title: "Design Systems", median: 175, p25: 150, p75: 210, growth: "+19%", count: "134" },
  { title: "UX Researcher", median: 139, p25: 115, p75: 165, growth: "-3%", count: "98" },
];

const SPARK_VALUES = [42, 38, 45, 51, 49, 55, 58, 63, 61, 70, 75, 87];

const HOT_KEYWORDS = [
  { kw: "Design systems", weight: 0.92, delta: "+34%" },
  { kw: "Figma", weight: 0.88, delta: "+18%" },
  { kw: "AI/ML products", weight: 0.76, delta: "+61%" },
  { kw: "Accessibility", weight: 0.72, delta: "+22%" },
  { kw: "Prototyping", weight: 0.68, delta: "+9%" },
  { kw: "User research", weight: 0.61, delta: "+5%" },
  { kw: "Motion design", weight: 0.44, delta: "-7%" },
];

const GEO_DATA = [
  { city: "San Francisco, CA", count: 312, salary: 185 },
  { city: "New York, NY", count: 248, salary: 172 },
  { city: "Remote · US", count: 387, salary: 158 },
  { city: "Seattle, WA", count: 141, salary: 168 },
  { city: "Austin, TX", count: 98, salary: 149 },
  { city: "Boston, MA", count: 61, salary: 161 },
];

function SalaryRange({ p25, p75, median, max }: { p25: number; p75: number; median: number; max: number }) {
  return (
    <div style={{ position: "relative", height: 6, background: "var(--paper-3)", borderRadius: 99 }}>
      <div style={{
        position: "absolute",
        left: `${(p25 / max) * 100}%`, width: `${((p75 - p25) / max) * 100}%`,
        top: 0, bottom: 0, background: "var(--accent-bg)", borderRadius: 99,
        border: "1px solid var(--accent-line)",
      }} />
      <div style={{
        position: "absolute",
        left: `${(median / max) * 100}%`,
        top: -3, bottom: -3, width: 2, background: "var(--accent)", borderRadius: 99,
      }} />
    </div>
  );
}

function SparkLine({ values, height = 80 }: { values: number[]; height?: number }) {
  const w = 360, h = height, pad = 8;
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as [number, number];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = path + ` L${pts[pts.length - 1]![0]},${h - pad} L${pts[0]![0]},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i === pts.length - 1 && (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}

export default function TrendsPage() {
  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">market intelligence · last 12 weeks · 1,247 listings sampled</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Trends <em>— what the market wants</em></h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Product Designer
          </button>
          <button className="btn" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            12 weeks
          </button>
          <button className="btn ghost" type="button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* Top row: 3 summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 18, marginBottom: 22 }}>
        {/* Hero card: roles trending */}
        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Roles you're targeting</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>median total comp · USD</span>
          </div>
          <div style={{ padding: "0 18px 14px" }}>
            {SALARY_DATA.map((s, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "1fr 60px 220px 60px 60px",
                gap: 14, alignItems: "center",
                padding: "12px 0",
                borderBottom: i === SALARY_DATA.length - 1 ? "none" : "1px dashed var(--line-soft)",
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 500 }}>{s.title}</span>
                <span className="mono" style={{ fontSize: 13, color: "var(--ink)" }}>${s.median}k</span>
                <SalaryRange p25={s.p25} p75={s.p75} median={s.median} max={260} />
                <span className="mono" style={{ color: s.growth.startsWith("+") ? "var(--success)" : "var(--danger)", fontSize: 12 }}>
                  {s.growth}
                </span>
                <span className="mono dim" style={{ fontSize: 12, textAlign: "right" }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini line chart card */}
        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Open roles, design</h2>
            <span className="chip success dot" style={{ fontSize: 11 }}>+24% vs 12w</span>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <SparkLine values={SPARK_VALUES} height={120} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "var(--ink-4)" }}>
              <span className="mono">W1</span>
              <span className="mono">W6</span>
              <span className="mono">W12</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 16 }}>
              <span className="h-display" style={{ fontSize: 28 }}>87</span>
              <span className="dim mono" style={{ fontSize: 12 }}>new this week</span>
            </div>
          </div>
        </div>

        {/* Your fit card */}
        <div className="card" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-line)" }}>
          <div className="card-h" style={{ borderBottomColor: "var(--accent-line)" }}>
            <h2 className="card-title" style={{ color: "var(--accent-ink)" }}>Your market fit</h2>
          </div>
          <div className="card-body" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="h-display" style={{ fontSize: 40, color: "var(--accent-ink)" }}>P74</span>
              <span style={{ fontSize: 13, color: "var(--accent-ink)" }}>percentile</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--accent-ink)", lineHeight: 1.55 }}>
              Your claim profile is stronger than 74% of designers in your target tier — driven by your design-system claim and quantified outcomes.
            </div>
            <button className="btn accent" type="button" style={{ width: "fit-content" }}>
              See breakdown
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Second row: keywords + geo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Keywords on the rise</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>vs 12 weeks ago</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {HOT_KEYWORDS.map((k) => (
              <div key={k.kw} style={{ display: "grid", gridTemplateColumns: "150px 1fr 60px", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{k.kw}</span>
                <div className="bar"><i style={{ width: `${k.weight * 100}%` }} /></div>
                <span className="mono" style={{ fontSize: 12, textAlign: "right", color: k.delta.startsWith("+") ? "var(--success)" : "var(--danger)" }}>
                  {k.delta}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Where the jobs are</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>count · median comp</span>
          </div>
          <div className="row-list">
            {GEO_DATA.map((g, i) => (
              <div key={i} className="row" style={{ gridTemplateColumns: "1fr 80px 90px 60px", cursor: "default" }}>
                <span style={{ fontSize: 13 }}>{g.city}</span>
                <span className="mono dim" style={{ fontSize: 12.5 }}>{g.count}</span>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--ink)" }}>${g.salary}k</span>
                <div style={{ width: 60 }}>
                  <div className="bar"><i style={{ width: `${(g.count / 1240) * 100}%`, background: "var(--accent-2)" }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
