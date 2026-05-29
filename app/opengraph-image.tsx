import { ImageResponse } from "next/og";
import { headers } from "next/headers";
export const runtime = "edge";
export const alt = "Accounting Body — Everything You Need for Accounting & Finance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function OGImage() {
  const headersList = await headers();
  const isEthioTax = headersList.get("x-et-platform") === "ethiotax";
  if (isEthioTax) {
    return new ImageResponse(
      (
        <div style={{ width: "1200px", height: "630px", background: "linear-gradient(135deg, #0d2b1f 0%, #1A4731 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#C9982A", display: "flex" }} />
          <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
            <svg width="52" height="58" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L3 7v13c0 6 5.5 10 13 12 7.5-2 13-6 13-12V7Z" fill="#C9982A"/>
              <polygon points="16,9 17.8,14.2 23.5,14.5 19,18.2 20.5,23.8 16,21 11.5,23.8 13,18.2 8.5,14.5 14.2,14.2" fill="#1A4731"/>
            </svg>
            <div style={{ display: "flex", alignItems: "flex-start", marginLeft: "16px" }}>
              <span style={{ color: "#ffffff", fontSize: "36px", fontWeight: "600" }}>EthioTax</span>
              <span style={{ color: "#ffffff", fontSize: "16px", fontWeight: "400", marginTop: "6px", marginLeft: "2px" }}>®</span>
            </div>
          </div>
          <div style={{ color: "#ffffff", fontSize: "52px", fontWeight: "700", textAlign: "center", lineHeight: 1.15, maxWidth: "900px", marginBottom: "24px" }}>
            Accounting, Tax & Business Consulting for the Ethiopian Community
          </div>
          <div style={{ color: "#C9982A", fontSize: "24px", fontWeight: "500", textAlign: "center" }}>
            Professional Services · Study Platform · Expert Network
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "6px", background: "#C9982A", display: "flex" }} />
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", background: "#0C1A3D", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#D4A017", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
          <svg width="52" height="40" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="9" height="20" fill="#ffffff" />
            <rect x="11" y="0" width="9" height="9" fill="#ffffff" />
            <rect x="11" y="11" width="9" height="9" fill="#ffffff" />
          </svg>
          <div style={{ display: "flex", alignItems: "flex-start", marginLeft: "16px" }}>
            <span style={{ color: "#ffffff", fontSize: "36px", fontWeight: "600" }}>Accounting Body</span>
            <span style={{ color: "#ffffff", fontSize: "16px", fontWeight: "400", marginTop: "6px", marginLeft: "2px" }}>®</span>
          </div>
        </div>
        <div style={{ color: "#ffffff", fontSize: "52px", fontWeight: "700", textAlign: "center", lineHeight: 1.15, maxWidth: "900px", marginBottom: "24px" }}>
          Everything You Need for Accounting & Finance
        </div>
        <div style={{ color: "#D4A017", fontSize: "24px", fontWeight: "500", textAlign: "center" }}>
          Professional Services · Study Platform · Expert Network
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "6px", background: "#D4A017", display: "flex" }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
