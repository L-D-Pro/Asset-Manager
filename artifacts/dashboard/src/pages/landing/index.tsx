import { Link } from "react-router-dom";
import { PublicLayout } from "../../components/layout/public-layout";

export default function LandingPage() {
  return (
    <PublicLayout showGetAccess>
      {/* Hero */}
      <section style={{
        padding: "72px 24px 64px",
        textAlign: "center",
        background: "linear-gradient(160deg, rgba(110,95,230,0.07) 0%, rgba(111,170,16,0.05) 100%), #F7F8FE",
        borderBottom: "1px solid #D8DCEC",
      }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{
            display: "inline-block",
            background: "rgba(111,170,16,0.12)",
            color: "#4a7a08",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            padding: "4px 12px",
            borderRadius: "20px",
            marginBottom: "20px",
          }}>
            Now in Early Access
          </div>

          <h1 style={{
            fontSize: "clamp(32px, 6vw, 48px)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.08,
            color: "#14152B",
            margin: "0 0 16px 0",
          }}>
            Win the job search.<br />
            <em style={{ color: "#6FAA10", fontStyle: "normal" }}>With AI in your corner.</em>
          </h1>

          <p style={{
            fontSize: "16px",
            color: "#6E7494",
            lineHeight: 1.6,
            maxWidth: "440px",
            margin: "0 auto 32px",
          }}>
            The AI-powered ops platform that tracks your pipeline, tailors your resume, and keeps you winning — one application at a time.
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", alignItems: "center", flexWrap: "wrap" as const }}>
            <Link
              to="/register"
              className="btn primary lg"
            >
              Enter the Arena →
            </Link>
            <Link
              to="/login"
              className="btn ghost lg"
            >
              Sign In
            </Link>
          </div>

          <p style={{ marginTop: "14px", fontSize: "12px", color: "#9CA0B8" }}>
            Invite-only ·{" "}
            <Link to="/register" style={{ color: "#6FAA10", textDecoration: "none", fontWeight: 700 }}>
              Join the waitlist
            </Link>
          </p>
        </div>
      </section>

      {/* Feature grid */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        background: "#D8DCEC",
        gap: "1px",
      }}>
        {[
          {
            icon: "🎯",
            iconBg: "rgba(111,170,16,0.12)",
            title: "AI Tailoring",
            desc: "Resume and cover letter matched to each job, grounded in your verified claims.",
          },
          {
            icon: "📋",
            iconBg: "rgba(110,95,230,0.12)",
            title: "Claims Ledger",
            desc: "Truth-lock your achievements. AI only cites what you've verified.",
          },
          {
            icon: "⚡",
            iconBg: "rgba(216,148,0,0.12)",
            title: "XP Pipeline",
            desc: "Track applications, level up, and stay motivated with real progress metrics.",
          },
        ].map((f) => (
          <div key={f.title} style={{
            background: "#ffffff",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column" as const,
            gap: "10px",
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: f.iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}>
              {f.icon}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#14152B" }}>{f.title}</div>
            <div style={{ fontSize: "13px", color: "#6E7494", lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </section>
    </PublicLayout>
  );
}
