import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PublicLayoutProps {
  showGetAccess?: boolean;
  children: ReactNode;
}

function PublicLayout({ showGetAccess = false, children }: PublicLayoutProps) {
  return (
    <div className="public-page">
      <header className="public-header">
        <Link
          to="/"
          style={{
            fontWeight: 900,
            fontSize: "18px",
            letterSpacing: "-0.03em",
            color: "#14152B",
            textDecoration: "none",
          }}
        >
          job<em style={{ color: "#6FAA10", fontStyle: "normal" }}>ops</em>
        </Link>
        <nav>
          <Link to="/login" className="public-nav-link">
            Sign in
          </Link>
          {showGetAccess && (
            <Link to="/register" className="btn primary sm">
              Get Access
            </Link>
          )}
        </nav>
      </header>

      <main>{children}</main>

      <footer className="public-footer">
        <span>© 2025 Jobops</span>
        <div>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}

export { PublicLayout };
