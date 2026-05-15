import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: "400px", padding: "48px" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold", margin: "0 0 8px 0" }}>404</h1>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 16px 0", color: "#6b7280" }}>Page Not Found</h2>
        <p style={{ fontSize: "0.875rem", margin: "0 0 32px 0", color: "#6b7280" }}>
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "8px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Go Back
          </button>
          <a
            href="/dashboard"
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "8px",
              background: "#3b82f6",
              color: "white",
              cursor: "pointer",
              fontSize: "0.875rem",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
