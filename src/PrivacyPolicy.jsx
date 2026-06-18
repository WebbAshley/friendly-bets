import { useEffect } from "react";
import logo from "./assets/logo.svg";

export default function PrivacyPolicy() {
  useEffect(() => {
    if (document.getElementById("termly-jssdk")) return;
    const script = document.createElement("script");
    script.id = "termly-jssdk";
    script.src = "https://app.termly.io/embed-policy.min.js";
    document.body.appendChild(script);
  }, []);

  return (
    <div style={{ background: "#1c1c1e", minHeight: "100vh", padding: "0 16px 60px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 0 24px" }}>
          <img src={logo} alt="Bro-Bets" style={{ width: 36, height: 36 }} />
          <span style={{ color: "#ffffff", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Bro-Bets</span>
        </div>
        <div
          name="termly-embed"
          data-id="7abc8019-2311-44f8-9f59-86ebeb690d10"
          data-type="iframe"
        />
      </div>
    </div>
  );
}
