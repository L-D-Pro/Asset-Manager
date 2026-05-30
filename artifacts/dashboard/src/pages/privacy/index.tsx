import { useNavigate } from "react-router-dom";
import { PublicLayout } from "../../components/layout/public-layout";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="public-doc">
        <button className="doc-back" onClick={() => navigate(-1)}>← Back</button>

        <h1 style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.03em", color: "#14152B", margin: "0 0 6px 0" }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: "12px", color: "#9CA0B8", margin: "0 0 4px 0" }}>Last updated: 2026</p>
        <div className="doc-accent-bar" />

        <div className="doc-section">
          <h2 className="doc-section-title">1. Overview</h2>
          <p className="doc-text">This Privacy Policy explains how Job Ops ("we", "us") collects, uses, and shares information when you register, upload resumes, or interact with pilot features.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">2. Information We Collect</h2>
          <ul className="doc-text" style={{ paddingLeft: "20px", marginTop: "6px" }}>
            <li><strong>Account information</strong>: username, email, password hash, pilot enrollment status</li>
            <li><strong>Profile details</strong>: first name, last name (optional)</li>
            <li><strong>Job application content</strong>: resumes, cover letters, job descriptions, application records</li>
            <li><strong>Security/session data</strong>: IP address, user agent, session cookies</li>
            <li><strong>Marketing data</strong>: UTM parameters (source, medium, campaign) captured at registration</li>
          </ul>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">3. How We Use Information</h2>
          <ul className="doc-text" style={{ paddingLeft: "20px", marginTop: "6px" }}>
            <li>Provide account access, authentication, and support</li>
            <li>Enable AI-powered resume tailoring and cover letter drafting</li>
            <li>Track application status and outcomes</li>
            <li>Maintain platform security and prevent abuse</li>
            <li>Improve pilot features and product stability</li>
          </ul>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">4. AI Features</h2>
          <p className="doc-text">Job Ops uses OpenRouter to power AI-assisted features including job description parsing, resume tailoring, and cover letter drafting. We send only the inputs needed to provide those features. We do not sell personal data.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">5. Sharing & Service Providers</h2>
          <p className="doc-text">We share data only with vendors required to operate the service:</p>
          <ul className="doc-text" style={{ paddingLeft: "20px", marginTop: "6px" }}>
            <li><strong>DigitalOcean</strong> — hosting and deployment</li>
            <li><strong>Neon</strong> — database hosting</li>
            <li><strong>Resend</strong> — email delivery (transactional emails only)</li>
            <li><strong>OpenRouter</strong> — AI API</li>
          </ul>
          <p className="doc-text" style={{ marginTop: "8px" }}>We do not run analytics, payments, or ad tracking at this time. We do not sell personal information.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">6. Cookies & Session Data</h2>
          <p className="doc-text">We use essential cookies to maintain sessions, keep your account secure, and store preferences. These cookies are required for the service to function. We do not use advertising or tracking cookies.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">7. Data Retention</h2>
          <p className="doc-text">Account data is retained until you request deletion. Job application content is retained until you delete it. Backups are retained per our hosting providers' default schedules.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">8. Security</h2>
          <p className="doc-text">We use encryption in transit, password hashing (bcrypt), access controls, and session-based authentication to protect data. No system is perfectly secure, but we apply reasonable safeguards for a pilot environment.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">9. Your Rights (US & California)</h2>
          <p className="doc-text">You may request access, correction, or deletion of your personal information. California residents may request disclosures required under applicable privacy laws. We do not sell personal information.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">10. International Access</h2>
          <p className="doc-text">The service is intended for users in the United States. Users from other regions may access the service except where prohibited. Access is not offered to residents of Russia, North Korea, or Iran.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">11. Children's Privacy</h2>
          <p className="doc-text">Job Ops is not intended for children under 13. We do not knowingly collect personal information from children.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">12. Changes to This Policy</h2>
          <p className="doc-text">We may update this policy as the pilot evolves. Material changes will be posted on this page.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">13. Contact</h2>
          <p className="doc-text">For privacy questions or requests, email <a href="mailto:cyrusplans@gmail.com" style={{ color: "#6FAA10" }}>cyrusplans@gmail.com</a>.</p>
        </div>
      </div>
    </PublicLayout>
  );
}
