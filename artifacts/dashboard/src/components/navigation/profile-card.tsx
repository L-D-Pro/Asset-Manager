import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type StatusKind = "applying" | "interview" | "offer" | "exploring" | "heads-down";
type StatusColor = "lime" | "pink" | "gold" | "cyan" | "violet";

interface ProfileStatus {
  kind: StatusKind;
  text: string;
}

interface ProfileLink {
  type: "site" | "linkedin" | "github" | "twitter" | "email" | "calendar";
  label: string;
  url: string;
}

interface Profile {
  name: string;
  handle: string;
  pronouns: string;
  title: string;
  bio: string;
  status: ProfileStatus;
  links: ProfileLink[];
  badges: string[];
  avatarInitials: string;
  avatarHue: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { kind: StatusKind; label: string; color: StatusColor }[] = [
  { kind: "applying",    label: "Applying",    color: "lime"   },
  { kind: "interview",   label: "Interview",   color: "pink"   },
  { kind: "offer",       label: "Offer",       color: "gold"   },
  { kind: "exploring",   label: "Exploring",   color: "cyan"   },
  { kind: "heads-down",  label: "Heads-down",  color: "violet" },
];

const LINK_TYPES: ProfileLink["type"][] = ["site", "linkedin", "github", "twitter", "email", "calendar"];

const BADGE_TONES = ["gold", "pink", "violet", "lime", "cyan"] as const;

const STORAGE_KEY = "jobops-profile";

const DEFAULT_PROFILE: Profile = {
  name: "Job Ops User",
  handle: "jobops.user",
  pronouns: "they/them",
  title: "Job seeker",
  bio: "Hunting for the right role. Grinding XP daily.",
  status: { kind: "applying", text: "Tailoring applications" },
  links: [],
  badges: ["Early adopter"],
  avatarInitials: "JO",
  avatarHue: 140,
};

// ── useProfile hook ──────────────────────────────────────────────────────────

export function useProfile(): [Profile, (patch: Partial<Profile> | ((p: Profile) => Profile)) => void] {
  const [profile, setProfile] = useState<Profile>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_PROFILE;
  });

  const update = useCallback((patch: Partial<Profile> | ((p: Profile) => Profile)) => {
    setProfile(p => {
      const next = typeof patch === "function" ? patch(p) : { ...p, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return [profile, update];
}

// ── SVG icons for links ──────────────────────────────────────────────────────

function LinkIcon({ type, size = 13 }: { type: ProfileLink["type"]; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "site":     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case "linkedin": return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10v7M7 7v.01M11 17v-5a2 2 0 0 1 4 0v5M11 12v-2"/></svg>;
    case "github":   return <svg {...p}><path d="M12 2a10 10 0 0 0-3 19.5c.5 0 .7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6 0-.6 0-.6 1 0 1.5 1 1.5 1 .9 1.5 2.3 1 2.8.8.1-.7.4-1.1.6-1.4-2.2-.2-4.5-1-4.5-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.6 0 0 .9-.3 2.8 1a9.5 9.5 0 0 1 5 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.6 0 3.8-2.3 4.5-4.5 4.7.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>;
    case "twitter":  return <svg {...p}><path d="M22 5.8a8 8 0 0 1-2.4.7 4 4 0 0 0 1.8-2.2 8 8 0 0 1-2.6 1 4 4 0 0 0-7 3.6A11 11 0 0 1 3 4.5a4 4 0 0 0 1.2 5.4 4 4 0 0 1-1.8-.5 4 4 0 0 0 3.2 4 4 4 0 0 1-1.8 0 4 4 0 0 0 3.8 2.8 8 8 0 0 1-6 1.7 11 11 0 0 0 6 1.8c7.2 0 11.2-6 11.2-11.2v-.5a8 8 0 0 0 2-2z"/></svg>;
    case "email":    return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    default: return <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
  }
}

// ── ProfileCard ──────────────────────────────────────────────────────────────

interface ProfileCardProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  level?: number;
  xp?: number;
  xpNext?: number;
}

export function ProfileCard({ open, anchorRef, onClose, level = 1, xp = 0, xpNext = 1000 }: ProfileCardProps) {
  const [profile, updateProfile] = useProfile();
  const [editing, setEditing] = useState(false);
  const [pos, setPos] = useState({ left: 260, top: 100 });
  const cardRef = useRef<HTMLDivElement>(null);
  const status = STATUS_OPTIONS.find(s => s.kind === profile.status?.kind) ?? STATUS_OPTIONS[0];
  const xpPct = Math.min(100, (xp / xpNext) * 100);

  const reposition = useCallback(() => {
    if (!anchorRef?.current || !cardRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const cardH = cardRef.current.offsetHeight;
    const idealTop = anchor.top - 60;
    const maxTop = window.innerHeight - cardH - 20;
    setPos({
      left: anchor.right + 10,
      top: Math.max(20, Math.min(maxTop, idealTop)),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const ro = new ResizeObserver(reposition);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        cardRef.current && !cardRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setEditing(false); onClose(); }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="profile-card"
      ref={cardRef}
      style={{ left: pos.left, top: pos.top }}>
      {/* Banner */}
      <div className="profile-banner" style={{
        background: `linear-gradient(135deg, oklch(0.5 0.18 ${profile.avatarHue}) 0%, oklch(0.3 0.12 ${(profile.avatarHue + 140) % 360}) 100%)`,
      }}>
        <div className="profile-banner-deco">
          <div className="banner-shape" style={{ top: 10, right: 30 }}/>
          <div className="banner-shape sq" style={{ top: 40, right: 90 }}/>
          <div className="banner-shape" style={{ top: 24, right: 160 }}/>
        </div>
        <button className="profile-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Avatar row */}
      <div className="profile-av-wrap">
        <div className="profile-av-frame" style={{
          background: `linear-gradient(135deg, oklch(0.5 0.18 ${profile.avatarHue}) 0%, oklch(0.4 0.14 ${(profile.avatarHue + 140) % 360}) 100%)`,
        }}>
          {profile.avatarInitials}
          <span className={`profile-status ${status.color}`}/>
        </div>
        {!editing && (
          <button
            className="btn sm"
            style={{
              alignSelf: "flex-start", marginLeft: "auto",
              background: "var(--card)", color: "var(--ink-2)",
              border: "1px solid var(--line)", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
            }}
            onClick={() => setEditing(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <ProfileEdit profile={profile} update={updateProfile} onDone={() => setEditing(false)}/>
      ) : (
        <ProfileView profile={profile} status={status} level={level} xp={xp} xpNext={xpNext} xpPct={xpPct}/>
      )}
    </div>
  );
}

// ── ProfileView ──────────────────────────────────────────────────────────────

function ProfileView({ profile, status, level, xp, xpNext, xpPct }: {
  profile: Profile;
  status: typeof STATUS_OPTIONS[0];
  level: number; xp: number; xpNext: number; xpPct: number;
}) {
  return (
    <div className="profile-body">
      <div className="profile-id">
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="profile-name">{profile.name}</span>
          {profile.pronouns && <span className="profile-pronouns">{profile.pronouns}</span>}
        </div>
        <div className="profile-handle"><span className="dim">@</span>{profile.handle}</div>
        <div className="profile-title">{profile.title}</div>
      </div>

      <div className={`profile-status-pill ${status.color}`}>
        <span className={`dot-${status.color}`}/>
        <span className="status-label">{status.label.toUpperCase()}</span>
        <span className="status-text">· {profile.status?.text}</span>
      </div>

      {profile.bio && (
        <div className="profile-section">
          <div className="profile-section-label">About</div>
          <div className="profile-bio">{profile.bio}</div>
        </div>
      )}

      <div className="profile-section">
        <div className="profile-section-label">Progress</div>
        <div className="profile-level-row">
          <div className="profile-level-stamp">{level}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)" }}>LEVEL {level}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>
                {xp.toLocaleString()} / {xpNext.toLocaleString()}
              </span>
            </div>
            <div className="bar thin xp"><i style={{ width: `${xpPct}%` }}/></div>
          </div>
        </div>
      </div>

      {profile.badges.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-label">Badges</div>
          <div className="profile-badges">
            {profile.badges.map((b, i) => (
              <div key={b} className={`profile-badge ${BADGE_TONES[i % BADGE_TONES.length]}`}>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.links.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-label">Links</div>
          <div className="profile-links">
            {profile.links.map((l, i) => (
              <a key={i} className="profile-link" href={l.url} target="_blank" rel="noopener noreferrer">
                <LinkIcon type={l.type} size={13}/>
                <span>{l.label}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="profile-foot">
        <button className="btn ghost sm" style={{ flex: 1 }}>Sign out</button>
      </div>
    </div>
  );
}

// ── ProfileEdit ──────────────────────────────────────────────────────────────

function ProfileEdit({ profile, update, onDone }: {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Profile>(profile);
  const save = () => { update(draft); onDone(); };
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <div className="profile-body">
      <div className="profile-section">
        <div className="profile-section-label">Identity</div>
        <div className="profile-fields">
          <div className="field">
            <label>Display name</label>
            <input className="input" value={draft.name} onChange={e => set("name", e.target.value)}/>
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Handle</label>
              <input className="input" value={draft.handle} onChange={e => set("handle", e.target.value)}/>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Pronouns</label>
              <input className="input" value={draft.pronouns} onChange={e => set("pronouns", e.target.value)} placeholder="she/her"/>
            </div>
          </div>
          <div className="field">
            <label>Title</label>
            <input className="input" value={draft.title} onChange={e => set("title", e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-section-label">Status</div>
        <div className="status-grid">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.kind}
              className={`status-chip-pick ${s.color} ${draft.status?.kind === s.kind ? "active" : ""}`}
              onClick={() => set("status", { ...draft.status, kind: s.kind })}>
              <span className={`dot-${s.color}`}/>{s.label}
            </button>
          ))}
        </div>
        <input
          className="input"
          style={{ marginTop: 8 }}
          value={draft.status?.text || ""}
          onChange={e => set("status", { ...draft.status, text: e.target.value })}
          placeholder="What are you up to?"/>
      </div>

      <div className="profile-section">
        <div className="profile-section-label">About</div>
        <textarea
          className="input"
          rows={3}
          style={{ resize: "vertical", fontFamily: "var(--font-ui)" }}
          value={draft.bio}
          onChange={e => set("bio", e.target.value)}/>
      </div>

      <div className="profile-section">
        <div className="profile-section-label">Links</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {draft.links.map((l, i) => (
            <div key={i} className="link-edit">
              <select
                className="input link-type-select"
                value={l.type}
                onChange={e => set("links", draft.links.map((x, j) => j === i ? { ...x, type: e.target.value as ProfileLink["type"] } : x))}>
                {LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                className="input"
                placeholder="Label"
                value={l.label}
                onChange={e => set("links", draft.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}/>
              <button
                className="btn ghost sm icon-btn"
                onClick={() => set("links", draft.links.filter((_, j) => j !== i))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          <button
            className="btn ghost sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() => set("links", [...draft.links, { type: "site", label: "", url: "" }])}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add link
          </button>
        </div>
      </div>

      <div className="profile-foot">
        <button className="btn ghost sm" style={{ flex: 1 }} onClick={onDone}>Cancel</button>
        <button className="btn primary sm" style={{ flex: 1 }} onClick={save}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          Save
        </button>
      </div>
    </div>
  );
}
