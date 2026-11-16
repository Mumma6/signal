import { ImageResponse } from "next/og";
export const alt = "Signal — Stay ahead of AI. Without the noise.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#101112",
        color: "#ececeb",
        padding: "65px 80px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[19, 31, 44, 31, 19].map((height, i) => (
            <div key={i} style={{ height, width: 4, borderRadius: 3, background: "#a4b9ff" }} />
          ))}
        </div>
        <span>signal.</span>
      </div>
      <div style={{ color: "#a4b9ff", fontSize: 14, letterSpacing: "3px", marginTop: 65 }}>
        YOUR DAILY DOSE OF CLARITY
      </div>
      <div style={{ fontSize: 76, letterSpacing: "-4px", marginTop: 25 }}>Stay ahead of AI.</div>
      <div style={{ fontSize: 76, letterSpacing: "-4px", color: "#92959b" }}>
        Without the noise.
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "auto",
          paddingTop: 25,
          borderTop: "1px solid #292b2e",
          fontSize: 19,
          color: "#92959b",
        }}
      >
        A little perspective. Every day.
      </div>
    </div>,
    size,
  );
}
