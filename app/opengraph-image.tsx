import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AccountingBody — Study smarter. Pass your accounting exams first time.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0C1A3D",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "6px", background: "#D4A017", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
          <svg width="52" height="40" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="9" height="20" fill="#ffffff" />
            <rect x="11" y="0" width="9" height="9" fill="#ffffff" />
            <rect x="11" y="11" width="9" height="9" fill="#ffffff" />
          </svg>
          <span style={{ color: "#ffffff", fontSize: "36px", fontWeight: "600", marginLeft: "16px" }}>
            Accounting Body<sup style={{ fontSize: "18px", verticalAlign: "super", lineHeight: 0 }}>®</sup>
          </span>
        </div>
        <div style={{ color: "#ffffff", fontSize: "52px", fontWeight: "700", textAlign: "center", lineHeight: 1.15, maxWidth: "900px", marginBottom: "24px" }}>
          Study smarter. Pass your accounting exams first time.
        </div>
        <div style={{ color: "#D4A017", fontSize: "24px", fontWeight: "500", textAlign: "center" }}>
          ACCA · CIMA · ICAEW · AAT
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "6px", background: "#D4A017", display: "flex" }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
