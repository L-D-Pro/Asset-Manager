import { Link } from "react-router-dom";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Pilot Version — Non-Final Legal Text · Effective: Pilot Phase (Pre-Release)</p>

        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2>1. Purpose of the Pilot</h2>
            <p>The Job Ops Pilot Program provides early access to pre-release features, workflows, and experimental functionality for AI-assisted job application management. The purpose of this pilot is to validate real job-seeking use cases and gather feedback that informs future product development.</p>
          </section>

          <section>
            <h2>2. Pre-Release Status</h2>
            <p>Job Ops is provided "as-is" during the pilot. Features may change, break, or be removed without notice. Performance, availability, and data persistence are not guaranteed.</p>
          </section>

          <section>
            <h2>3. User Responsibilities</h2>
            <p>Participants agree to:</p>
            <ul>
              <li>Use the platform responsibly and in good faith</li>
              <li>Avoid misuse, abuse, or attempts to circumvent security</li>
              <li>Provide feedback when possible to support product improvement</li>
              <li>Not upload harmful, illegal, or infringing content</li>
            </ul>
          </section>

          <section>
            <h2>4. Data & Content Ownership</h2>
            <p>You retain ownership of the resumes, cover letters, job descriptions, and other content you create or upload. By participating in the pilot, you grant L&D PRO a limited license to process, store, and display your content solely for the purpose of operating and improving the platform.</p>
          </section>

          <section>
            <h2>5. Feedback License</h2>
            <p>Any feedback, suggestions, or ideas you provide may be used by L&D PRO to improve the product without obligation to compensate you.</p>
          </section>

          <section>
            <h2>6. Access & Availability</h2>
            <p>Pilot access is discretionary and may be modified or revoked at any time. Participation does not guarantee future access, feature continuity, or inclusion in paid tiers.</p>
          </section>

          <section>
            <h2>7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Attempt to reverse engineer or extract source code</li>
              <li>Interfere with platform stability or security</li>
              <li>Misrepresent your identity or access rights</li>
              <li>Use the platform for mass automated applications</li>
            </ul>
          </section>

          <section>
            <h2>8. Third-Party Services</h2>
            <p>The platform integrates with third-party services including OpenRouter (AI API), DigitalOcean (hosting), and Neon (database). Use of these services is subject to their respective terms.</p>
          </section>

          <section>
            <h2>9. Cookies</h2>
            <p>We use essential cookies to operate and secure the platform, including maintaining user sessions. These cookies are required for the service to function and cannot be disabled. We do not sell personal data or use cookies for advertising.</p>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, L&D PRO is not liable for any loss of data, downtime, or damages arising from participation in the pilot. This pilot is experimental and not intended for production-critical use.</p>
          </section>

          <section>
            <h2>11. Modifications to Terms</h2>
            <p>These pilot Terms of Service may be updated as the product evolves. Continued participation constitutes acceptance of updated terms.</p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>For questions or issues, contact us at <a href="mailto:cyrusplans@gmail.com">cyrusplans@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
