import { useNavigate } from "react-router-dom";
import { PublicLayout } from "../../components/layout/public-layout";

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="public-doc">
        <button className="doc-back" onClick={() => navigate(-1)}>← Back</button>

        <h1 style={{ fontSize: "22px", fontWeight: 900, letterSpacing: "-0.03em", color: "#14152B", margin: "0 0 6px 0" }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: "12px", color: "#9CA0B8", margin: "0 0 4px 0" }}>Last updated: 2026</p>
        <div className="doc-accent-bar" />

        <div className="doc-section">
          <h2 className="doc-section-title">1. Purpose of the Pilot</h2>
          <p className="doc-text">The Job Ops Pilot Program provides early access to pre-release features, workflows, and experimental functionality for AI-assisted job application management. The purpose of this pilot is to validate real job-seeking use cases and gather feedback that informs future product development.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">2. Pre-Release Status</h2>
          <p className="doc-text">Job Ops is provided "as-is" during the pilot. Features may change, break, or be removed without notice. Performance, availability, and data persistence are not guaranteed.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">3. User Responsibilities</h2>
          <p className="doc-text">Participants agree to:</p>
          <ul className="doc-text" style={{ paddingLeft: "20px", marginTop: "6px" }}>
            <li>Use the platform responsibly and in good faith</li>
            <li>Avoid misuse, abuse, or attempts to circumvent security</li>
            <li>Provide feedback when possible to support product improvement</li>
            <li>Not upload harmful, illegal, or infringing content</li>
          </ul>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">4. Data & Content Ownership</h2>
          <p className="doc-text">You retain ownership of the resumes, cover letters, job descriptions, and other content you create or upload. By participating in the pilot, you grant L&D PRO a limited license to process, store, and display your content solely for the purpose of operating and improving the platform.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">5. Feedback License</h2>
          <p className="doc-text">Any feedback, suggestions, or ideas you provide may be used by L&D PRO to improve the product without obligation to compensate you.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">6. Access & Availability</h2>
          <p className="doc-text">Pilot access is discretionary and may be modified or revoked at any time. Participation does not guarantee future access, feature continuity, or inclusion in paid tiers.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">7. Acceptable Use</h2>
          <p className="doc-text">You agree not to:</p>
          <ul className="doc-text" style={{ paddingLeft: "20px", marginTop: "6px" }}>
            <li>Attempt to reverse engineer or extract source code</li>
            <li>Interfere with platform stability or security</li>
            <li>Misrepresent your identity or access rights</li>
            <li>Use the platform for mass automated applications</li>
          </ul>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">8. Third-Party Services</h2>
          <p className="doc-text">The platform integrates with third-party services including OpenRouter (AI API), DigitalOcean (hosting), and Neon (database). Use of these services is subject to their respective terms.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">9. Cookies</h2>
          <p className="doc-text">We use essential cookies to operate and secure the platform, including maintaining user sessions. These cookies are required for the service to function and cannot be disabled. We do not sell personal data or use cookies for advertising.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">10. Limitation of Liability</h2>
          <p className="doc-text">To the maximum extent permitted by law, L&D PRO is not liable for any loss of data, downtime, or damages arising from participation in the pilot. This pilot is experimental and not intended for production-critical use.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">11. Modifications to Terms</h2>
          <p className="doc-text">These pilot Terms of Service may be updated as the product evolves. Continued participation constitutes acceptance of updated terms.</p>
        </div>

        <div className="doc-section">
          <h2 className="doc-section-title">12. Contact</h2>
          <p className="doc-text">For questions or issues, contact us at <a href="mailto:cyrusplans@gmail.com" style={{ color: "#6FAA10" }}>cyrusplans@gmail.com</a>.</p>
        </div>
      </div>
    </PublicLayout>
  );
}
