import { Link } from "react-router-dom";

export default function PrivacyPolicyPage() {
  return (
    <div>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 16px 80px" }}>
        <Link to="/" style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "32px", display: "inline-block", textDecoration: "none" }}>&larr; Back to Home</Link>

        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", margin: "0 0 8px 0" }}>Privacy Policy</h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "0 0 48px 0" }}>Last updated: 2026</p>

          <div style={{ padding: "32px", border: "1px solid #e5e7eb", borderRadius: "12px", fontSize: "0.875rem", lineHeight: 1.75, color: "#374151" }}>
            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>1. Overview</h2>
              <p>This Privacy Policy explains how Job Ops ("we", "us") collects, uses, and shares information when you register, upload resumes, or interact with pilot features.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>2. Information We Collect</h2>
              <ul style={{ paddingLeft: "24px", margin: "8px 0 0 0" }}>
                <li><strong>Account information</strong>: username, email, password hash, pilot enrollment status</li>
                <li><strong>Profile details</strong>: first name, last name (optional)</li>
                <li><strong>Job application content</strong>: resumes, cover letters, job descriptions, application records</li>
                <li><strong>Security/session data</strong>: IP address, user agent, session cookies</li>
                <li><strong>Marketing data</strong>: UTM parameters (source, medium, campaign) captured at registration</li>
              </ul>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>3. How We Use Information</h2>
              <ul style={{ paddingLeft: "24px", margin: "8px 0 0 0" }}>
                <li>Provide account access, authentication, and support</li>
                <li>Enable AI-powered resume tailoring and cover letter drafting</li>
                <li>Track application status and outcomes</li>
                <li>Maintain platform security and prevent abuse</li>
                <li>Improve pilot features and product stability</li>
              </ul>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>4. AI Features</h2>
              <p>Job Ops uses OpenRouter to power AI-assisted features including job description parsing, resume tailoring, and cover letter drafting. We send only the inputs needed to provide those features. We do not sell personal data.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>5. Sharing & Service Providers</h2>
              <p>We share data only with vendors required to operate the service:</p>
              <ul style={{ paddingLeft: "24px", margin: "8px 0 0 0" }}>
                <li><strong>DigitalOcean</strong> — hosting and deployment</li>
                <li><strong>Neon</strong> — database hosting</li>
                <li><strong>Resend</strong> — email delivery (transactional emails only)</li>
                <li><strong>OpenRouter</strong> — AI API</li>
              </ul>
              <p>We do not run analytics, payments, or ad tracking at this time. We do not sell personal information.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>6. Cookies & Session Data</h2>
              <p>We use essential cookies to maintain sessions, keep your account secure, and store preferences. These cookies are required for the service to function. We do not use advertising or tracking cookies.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>7. Data Retention</h2>
              <p>Account data is retained until you request deletion. Job application content is retained until you delete it. Backups are retained per our hosting providers' default schedules.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>8. Security</h2>
              <p>We use encryption in transit, password hashing (bcrypt), access controls, and session-based authentication to protect data. No system is perfectly secure, but we apply reasonable safeguards for a pilot environment.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>9. Your Rights (US & California)</h2>
              <p>You may request access, correction, or deletion of your personal information. California residents may request disclosures required under applicable privacy laws. We do not sell personal information.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>10. International Access</h2>
              <p>The service is intended for users in the United States. Users from other regions may access the service except where prohibited. Access is not offered to residents of Russia, North Korea, or Iran.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>11. Children's Privacy</h2>
              <p>Job Ops is not intended for children under 13. We do not knowingly collect personal information from children.</p>
            </section>

            <section style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>12. Changes to This Policy</h2>
              <p>We may update this policy as the pilot evolves. Material changes will be posted on this page.</p>
            </section>

            <section>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 8px 0" }}>13. Contact</h2>
              <p>For privacy questions or requests, email <a href="mailto:cyrusplans@gmail.com" style={{ color: "#3b82f6" }}>cyrusplans@gmail.com</a>.</p>
            </section>
          </div>
        </div>

        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #e5e7eb", fontSize: "0.75rem", color: "#6b7280" }}>
          <p style={{ margin: "0 0 4px 0" }}>&copy; 2026 L&D PRO. All rights reserved. Job Ops is a product of L&D PRO.</p>
          <p style={{ margin: 0 }}>
            <Link to="/terms-of-service" style={{ color: "#6b7280", textDecoration: "none" }}>Terms of Service</Link>
            <span> | </span>
            <Link to="/privacy-policy" style={{ color: "#6b7280", textDecoration: "none" }}>Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
