import { Link } from "react-router-dom";

interface PublicLayoutProps {
  showGetAccess?: boolean;
  children: React.ReactNode;
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
          <Link
            to="/login"
            style={{ color: "#6E7494", textDecoration: "none", fontSize: "13px" }}
          >
            Sign in
          </Link>
          {showGetAccess && (
            <button className="btn primary sm">Get Access</button>
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
