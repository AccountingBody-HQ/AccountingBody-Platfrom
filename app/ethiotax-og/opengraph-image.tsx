import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EthioTax — Accounting, Tax & Business Consulting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function EthioTaxOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0d2b1f 0%, #1A4731 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8px", background: "#C9982A", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
          <svg width="52" height="60" viewBox="0 0 32 36" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 1L2 6v14c0 7 6 11 14 13 8-2 14-6 14-13V6Z" fill="#C9982A"/>
            <polygon points="16,9 17.8,14.5 23.5,14.8 19,18.5 20.8,24.2 16,21.2 11.2,24.2 13,18.5 8.5,14.8 14.2,14.5" fill="#ffffff"/>
          </svg>
          <div style={{ display: "flex", alignItems: "flex-start", marginLeft: "16px" }}>
            <span style={{ color: "#ffffff", fontSize: "42px", fontWeight: "700" }}>EthioTax</span>
            <span style={{ color: "#ffffff", fontSize: "18px", marginTop: "8px", marginLeft: "3px" }}>&#174;</span>
          </div>
        </div>
        <div style={{ color: "#ffffff", fontSize: "48px", fontWeight: "700", textAlign: "center", lineHeight: 1.2, maxWidth: "900px", marginBottom: "20px" }}>
          Accounting, Tax &amp; Business Consulting
        </div>
        <div style={{ color: "#C9982A", fontSize: "22px", fontWeight: "500", textAlign: "center", marginBottom: "12px" }}>
          For the Ethiopian Community — Worldwide
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "18px", textAlign: "center" }}>
          Professional Services · Study Platform · Expert Network
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "8px", background: "#C9982A", display: "flex" }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
