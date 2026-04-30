import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { useAuth } from "@/context/auth";
import { Shield } from "lucide-react";

export default function AdminDocsPage() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <ContentCard>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
      </ContentCard>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Admin Documentation"
        subtitle="Technical documentation for deployment, database, and system configuration."
        gradient="from-slate-700 to-slate-600"
      />

      <div className="space-y-8">
        <ContentCard>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Architecture
            </CardTitle>
            <CardDescription>Express 5 API + React/Vite frontend + PostgreSQL (Neon) + OpenRouter AI + Resend email</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>Session-based auth (PostgreSQL-backed, connect-pg-simple)</li>
              <li>bcrypt password hashing (cost factor 12)</li>
              <li>TOTP 2FA with single-use recovery codes</li>
              <li>Drizzle ORM with drizzle-kit migrations + runtime-compat.sql fallback</li>
              <li>Hosted on DigitalOcean App Platform</li>
            </ul>
          </CardContent>
        </ContentCard>

        <ContentCard>
          <CardHeader>
            <CardTitle>Database</CardTitle>
            <CardDescription>Key tables relevant to administration</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div>
              <p className="font-medium">admin_users</p>
              <p className="text-muted-foreground">All user accounts. Columns: id, username, email, role, emailVerified, isActive, isPilotParticipant, pilotEnrollmentType, utmSource/Medium/Campaign</p>
            </div>
            <div>
              <p className="font-medium">invite_codes</p>
              <p className="text-muted-foreground">Pilot invitation codes. Columns: code, maxUses, usedCount, expiresAt, isActive, createdByAdminId</p>
            </div>
            <div>
              <p className="font-medium">user_usage_limits</p>
              <p className="text-muted-foreground">Weekly AI request quotas. Columns: userId, weeklyLimit, weeklyUsed, totalUsed, periodStart</p>
            </div>
            <div>
              <p className="font-medium">wizard_sessions</p>
              <p className="text-muted-foreground">Saved apply wizard state. Columns: userId, jobId, currentStep, state (JSONB)</p>
            </div>
          </CardContent>
        </ContentCard>

        <ContentCard>
          <CardHeader>
            <CardTitle>Admin Operations</CardTitle>
            <CardDescription>Common tasks for platform administrators</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <div>
              <p className="font-medium">Generate Invite Codes</p>
              <p className="text-muted-foreground">Navigate to Admin &gt; Invite Codes. Set max uses and expiry days. Copy generated code to distribute.</p>
            </div>
            <div>
              <p className="font-medium">Manage Usage Limits</p>
              <p className="text-muted-foreground">Navigate to Admin &gt; Usage Limits. View all users' weekly usage. Click edit to adjust per-user limits.</p>
            </div>
            <div>
              <p className="font-medium">Bootstrap Admin</p>
              <p className="text-muted-foreground">Set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL in .env. Created automatically on first run.</p>
            </div>
            <div>
              <p className="font-medium">Promote User to Admin</p>
              <pre className="bg-muted rounded p-2 mt-1 font-mono text-xs">UPDATE admin_users SET role = 'admin' WHERE id = 1;</pre>
            </div>
            <div>
              <p className="font-medium">Apply Schema Migration</p>
              <pre className="bg-muted rounded p-2 mt-1 font-mono text-xs">{`$env:DATABASE_URL = (Select-String -Path .env -Pattern "^DATABASE_URL=(.*)" | ForEach-Object { $_.Matches.Groups[1].Value })
corepack pnpm --filter @workspace/db run compat`}</pre>
            </div>
          </CardContent>
        </ContentCard>

        <ContentCard>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>Sensitive configuration (do not commit)</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-2 text-muted-foreground">
              <li><code className="bg-muted px-1 rounded">DATABASE_URL</code> — PostgreSQL connection string</li>
              <li><code className="bg-muted px-1 rounded">SESSION_SECRET</code> — Random 64-char string</li>
              <li><code className="bg-muted px-1 rounded">RESEND_API_KEY</code> — Resend API key</li>
              <li><code className="bg-muted px-1 rounded">FROM_EMAIL</code> — Verified sender email</li>
              <li><code className="bg-muted px-1 rounded">AI_INTEGRATIONS_OPENROUTER_API_KEY</code> — OpenRouter key</li>
              <li><code className="bg-muted px-1 rounded">ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL</code> — Bootstrap admin</li>
              <li><code className="bg-muted px-1 rounded">VITE_ENABLE_APPLY_WIZARD</code> — Feature flag for wizard</li>
            </ul>
          </CardContent>
        </ContentCard>

        <ContentCard>
          <CardHeader>
            <CardTitle>Security Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>Passwords: bcrypt cost factor 12. Never store plaintext.</p>
            <p>Sessions: httpOnly cookies, sameSite strict in production, 7-day maxAge.</p>
            <p>Rate limiting: login (5/15min), TOTP (10/15min) per IP.</p>
            <p>Email verification: Required before login for pilot users.</p>
            <p>Usage limits: Enforced at API layer on all AI endpoints.</p>
            <p>API responses: Never expose passwordHash, totpSecret, or totpRecoveryCodes.</p>
          </CardContent>
        </ContentCard>

        <ContentCard>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p><strong>User can't log in:</strong> Check email_verified = true and is_active = true.</p>
            <p><strong>Email not sending:</strong> Verify RESEND_API_KEY and FROM_EMAIL. Check domain DNS at resend.com.</p>
            <p><strong>Session issues:</strong> Clear cookies, verify SESSION_SECRET matches, check PostgreSQL session table.</p>
            <p><strong>Schema drift:</strong> Use runtime-compat.sql migration instead of drizzle-kit push (TUI-interactive).</p>
          </CardContent>
        </ContentCard>
      </div>
    </div>
  );
}
