import { useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../components/layout/public-layout";
import { ChevronDown } from "lucide-react";

/* ─── shared styles ─── */
const section = (extra?: object) => ({
  padding: "72px 24px",
  borderBottom: "1px solid #D8DCEC",
  ...extra,
});

const container = (extra?: object) => ({
  maxWidth: "860px",
  margin: "0 auto",
  ...extra,
});

const eyebrow = {
  display: "inline-block" as const,
  background: "rgba(111,170,16,0.12)",
  color: "#4a7a08",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  padding: "4px 12px",
  borderRadius: "20px",
  marginBottom: "16px",
};

const sectionHeading = {
  fontSize: "clamp(24px, 4vw, 34px)",
  fontWeight: 900,
  letterSpacing: "-0.03em",
  lineHeight: 1.12,
  color: "#14152B",
  margin: "0 0 12px 0",
};

const sectionSub = {
  fontSize: "15px",
  color: "#6E7494",
  lineHeight: 1.6,
  maxWidth: "520px",
};

const card = (extra?: object) => ({
  background: "#ffffff",
  border: "1px solid #D8DCEC",
  borderRadius: "12px",
  padding: "24px",
  ...extra,
});

/* ─── FAQ item component ─── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: "1px solid #D8DCEC",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left" as const,
          gap: "16px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#14152B" }}>{q}</span>
        <ChevronDown
          size={16}
          style={{
            color: "#6E7494",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && (
        <p style={{ fontSize: "13px", color: "#6E7494", lineHeight: 1.65, margin: "0 0 18px 0", paddingRight: "32px" }}>
          {a}
        </p>
      )}
    </div>
  );
}

/* ─── Main export ─── */
export default function LandingPage() {
  return (
    <PublicLayout showGetAccess>

      {/* ① Hero */}
      <section style={{
        ...section(),
        background: "linear-gradient(160deg, rgba(110,95,230,0.07) 0%, rgba(111,170,16,0.05) 100%), #F7F8FE",
        textAlign: "center",
        padding: "80px 24px 72px",
      }}>
        <div style={container({ maxWidth: "620px" })}>
          <div style={eyebrow}>Now in Early Access</div>

          <h1 style={{
            fontSize: "clamp(34px, 6vw, 52px)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1.06,
            color: "#14152B",
            margin: "0 0 18px 0",
          }}>
            Win the job search.<br />
            <em style={{ color: "#6FAA10", fontStyle: "normal" }}>With AI in your corner.</em>
          </h1>

          <p style={{ ...sectionSub, margin: "0 auto 32px", textAlign: "center" }}>
            The AI-powered ops platform that tracks your pipeline, tailors your resume to every job, and keeps you moving — grounded in verified truth, approved by you.
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" as const }}>
            <Link to="/register" className="btn primary lg">Enter the Arena →</Link>
            <Link to="/login" className="btn ghost lg">Sign In</Link>
          </div>

          <p style={{ marginTop: "14px", fontSize: "12px", color: "#9CA0B8" }}>
            Invite-only ·{" "}
            <Link to="/register" style={{ color: "#6FAA10", textDecoration: "none", fontWeight: 700 }}>Join the waitlist</Link>
          </p>
        </div>
      </section>

      {/* ② Stats bar */}
      <section style={{ borderBottom: "1px solid #D8DCEC", background: "#ffffff" }}>
        <div style={{
          ...container(),
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          background: "#D8DCEC",
        }}>
          {[
            { value: "100%", label: "Verified claims — AI never cites what you haven't confirmed" },
            { value: "3 steps", label: "From job description to tailored resume and cover letter" },
            { value: "1 platform", label: "Pipeline, AI drafts, claims, analytics — all in one place" },
          ].map(({ value, label }) => (
            <div key={value} style={{ background: "#ffffff", padding: "28px 24px", textAlign: "center" as const }}>
              <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.04em", color: "#14152B", marginBottom: "6px" }}>
                {value}
              </div>
              <div style={{ fontSize: "12px", color: "#6E7494", lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ③ How It Works */}
      <section style={section()}>
        <div style={container()}>
          <div style={{ marginBottom: "48px" }}>
            <div style={eyebrow}>How It Works</div>
            <h2 style={sectionHeading}>Three steps to a better application.</h2>
            <p style={sectionSub}>No magic, no hallucinations. Just a tight workflow that keeps you in control at every step.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {[
              {
                step: "01",
                color: "#6FAA10",
                bg: "rgba(111,170,16,0.08)",
                title: "Build your Claims Ledger",
                desc: "Add verified achievements, skills, and experiences. The AI can only cite what you've confirmed — no fabrication, ever.",
              },
              {
                step: "02",
                color: "#8E7DFF",
                bg: "rgba(110,95,230,0.08)",
                title: "Paste a job description",
                desc: "Jobops parses the role, scores your fit against your claims, and identifies exactly what to emphasize.",
              },
              {
                step: "03",
                color: "#D89400",
                bg: "rgba(216,148,0,0.08)",
                title: "Generate, review, approve",
                desc: "AI drafts a tailored resume and cover letter. You review every word and approve before anything goes out.",
              },
            ].map(({ step, color, bg, title, desc }) => (
              <div key={step} style={card()}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "16px",
                }}>
                  <span style={{ fontSize: "13px", fontWeight: 900, color, fontFamily: "monospace" }}>{step}</span>
                </div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#14152B", marginBottom: "8px" }}>{title}</div>
                <div style={{ fontSize: "13px", color: "#6E7494", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ④ Features */}
      <section style={{ ...section(), background: "#F7F8FE" }}>
        <div style={container()}>
          <div style={{ marginBottom: "48px" }}>
            <div style={eyebrow}>Features</div>
            <h2 style={sectionHeading}>Everything you need.<br /><em style={{ color: "#6FAA10", fontStyle: "normal" }}>Nothing you don't.</em></h2>
            <p style={sectionSub}>Built for serious job seekers who want to apply smarter, not just faster.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            {[
              {
                icon: "🔐",
                bg: "rgba(111,170,16,0.10)",
                title: "Claims Ledger",
                desc: "Your verified source of truth. Every bullet on every resume is traceable back to a confirmed claim. No hallucinations, guaranteed.",
              },
              {
                icon: "🎯",
                bg: "rgba(110,95,230,0.10)",
                title: "AI Resume Tailoring",
                desc: "Paste a JD and get a tailored resume in seconds — built from your claims, matched to the role, reviewed by you before it goes anywhere.",
              },
              {
                icon: "✉️",
                bg: "rgba(216,148,0,0.10)",
                title: "Cover Letter Drafts",
                desc: "Role-specific cover letters that actually sound like you. The AI adapts your voice to each application, you approve the final copy.",
              },
              {
                icon: "📊",
                bg: "rgba(79,209,255,0.10)",
                title: "Pipeline Tracker",
                desc: "A funnel view of every active application — Saved, In Draft, Submitted, Interviewing, Offers. Know exactly where you stand.",
              },
              {
                icon: "⚡",
                bg: "rgba(255,61,127,0.10)",
                title: "XP & Progress",
                desc: "Gamified momentum. Earn XP for every application milestone, track your streak, and stay motivated through the grind.",
              },
              {
                icon: "🧠",
                bg: "rgba(111,170,16,0.10)",
                title: "AI Learning Loop",
                desc: "Every approval and rejection trains the system. The model that works best for your profile rises to the top automatically.",
              },
            ].map(({ icon, bg, title, desc }) => (
              <div key={title} style={card()}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "10px",
                  background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", marginBottom: "14px",
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#14152B", marginBottom: "6px" }}>{title}</div>
                <div style={{ fontSize: "13px", color: "#6E7494", lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑤ Comparison */}
      <section style={section()}>
        <div style={container()}>
          <div style={{ marginBottom: "40px" }}>
            <div style={eyebrow}>Why Jobops</div>
            <h2 style={sectionHeading}>How we stack up.</h2>
            <p style={sectionSub}>There are a lot of ways to apply to jobs. Here's how Jobops compares to the alternatives.</p>
          </div>

          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" as const, padding: "12px 16px", borderBottom: "2px solid #D8DCEC", color: "#6E7494", fontWeight: 700, fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>Feature</th>
                  {[
                    { label: "Jobops", highlight: true },
                    { label: "Manual applying", highlight: false },
                    { label: "Generic AI tools", highlight: false },
                  ].map(({ label, highlight }) => (
                    <th key={label} style={{
                      textAlign: "center" as const,
                      padding: "12px 16px",
                      borderBottom: "2px solid #D8DCEC",
                      color: highlight ? "#6FAA10" : "#6E7494",
                      fontWeight: 800,
                      fontSize: highlight ? "13px" : "12px",
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Verified claims (no AI hallucinations)", true, false, false],
                  ["Tailored resume per job", true, "Slow", "Risky"],
                  ["Cover letter drafting", true, "Manual", "Generic"],
                  ["Application pipeline tracker", true, false, false],
                  ["AI learns from your outcomes", true, false, false],
                  ["Human approval before sending", true, true, false],
                  ["Single platform for everything", true, false, false],
                ].map(([label, a, b, c], i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#F7F8FE" : "#ffffff" }}>
                    <td style={{ padding: "12px 16px", color: "#14152B", fontWeight: 600 }}>{label as string}</td>
                    {[a, b, c].map((val, j) => (
                      <td key={j} style={{ padding: "12px 16px", textAlign: "center" as const }}>
                        {val === true ? (
                          <span style={{ color: "#6FAA10", fontWeight: 800, fontSize: "16px" }}>✓</span>
                        ) : val === false ? (
                          <span style={{ color: "#D8DCEC", fontWeight: 800, fontSize: "16px" }}>✕</span>
                        ) : (
                          <span style={{ color: "#9CA0B8", fontSize: "12px" }}>{val as string}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ⑥ FAQ */}
      <section style={{ ...section(), background: "#F7F8FE" }}>
        <div style={container({ maxWidth: "640px" })}>
          <div style={{ marginBottom: "40px" }}>
            <div style={eyebrow}>FAQ</div>
            <h2 style={sectionHeading}>Common questions.</h2>
          </div>

          {[
            {
              q: "What is Jobops?",
              a: "Jobops is an AI-powered job application platform. It helps you build a verified claims ledger, tailor your resume and cover letter to each job, track your pipeline, and learn from every outcome — all in one place.",
            },
            {
              q: "How is this different from ChatGPT or other AI tools?",
              a: "Most AI tools generate content from scratch — which means they can hallucinate skills and experience you don't have. Jobops is grounded in your Claims Ledger: every resume bullet is sourced from facts you've verified. The AI can only cite what's been confirmed.",
            },
            {
              q: "What's the Claims Ledger?",
              a: "It's your personal database of verified achievements, skills, roles, and outcomes. Before any AI draft goes out, it's checked against your ledger. Structurally invalid citations are dropped automatically — not just filtered by prompt.",
            },
            {
              q: "Is Jobops invite-only?",
              a: "Yes, currently. We're in early access with a small group of users. You can request an invite code or join the waitlist and we'll reach out when spots open.",
            },
            {
              q: "Is my data safe?",
              a: "Yes. Your resume data, job descriptions, and application history are stored securely (encrypted in transit, bcrypt-hashed passwords) and are never sold or shared with third parties. See our Privacy Policy for full details.",
            },
          ].map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      {/* ⑦ Final CTA */}
      <section style={{
        ...section(),
        background: "linear-gradient(160deg, rgba(110,95,230,0.07) 0%, rgba(111,170,16,0.05) 100%), #F7F8FE",
        textAlign: "center",
        borderBottom: "none",
      }}>
        <div style={container({ maxWidth: "540px" })}>
          <h2 style={{ ...sectionHeading, margin: "0 0 14px 0" }}>
            Ready to win the<br />
            <em style={{ color: "#6FAA10", fontStyle: "normal" }}>job search?</em>
          </h2>
          <p style={{ ...sectionSub, margin: "0 auto 32px", textAlign: "center" as const }}>
            Join the early access program and get your AI job ops platform up and running today.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" as const }}>
            <Link to="/register" className="btn primary lg">Enter the Arena →</Link>
            <Link to="/login" className="btn ghost lg">Sign In</Link>
          </div>
          <p style={{ marginTop: "14px", fontSize: "12px", color: "#9CA0B8" }}>
            Invite-only ·{" "}
            <Link to="/register" style={{ color: "#6FAA10", textDecoration: "none", fontWeight: 700 }}>Join the waitlist</Link>
          </p>
        </div>
      </section>

    </PublicLayout>
  );
}
