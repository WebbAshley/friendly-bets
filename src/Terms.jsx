import logo from "./assets/logo.svg";

export default function Terms() {
  return (
    <div style={{ background: "#1c1c1e", minHeight: "100vh", padding: "0 16px 60px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 0 24px" }}>
          <img src={logo} alt="Bro-Bets" style={{ width: 36, height: 36 }} />
          <span style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Bro-Bets</span>
        </div>
        <div style={{ color: "#888", fontSize: 16, marginTop: 40, textAlign: "center" }}>
          Terms of Service coming soon.
        </div>
      </div>
    </div>
  );
}
