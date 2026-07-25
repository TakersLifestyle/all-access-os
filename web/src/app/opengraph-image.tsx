import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ALL ACCESS Winnipeg — Community Events & Experiences";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#080808",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "60px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Pink glow top-right */}
        <div
          style={{
            position: "absolute",
            top: "-150px",
            right: "-150px",
            width: "700px",
            height: "700px",
            background: "radial-gradient(circle, rgba(255,0,127,0.28) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Pink glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-100px",
            width: "400px",
            height: "400px",
            background: "radial-gradient(circle, rgba(255,0,127,0.12) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Left accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "3px",
            height: "180px",
            background: "linear-gradient(to bottom, #ff007f, transparent)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            background: "#ff007f",
            borderRadius: "100px",
            padding: "10px 24px",
            marginBottom: "28px",
            fontSize: "13px",
            fontWeight: "800",
            letterSpacing: "4px",
            color: "white",
            textTransform: "uppercase",
          }}
        >
          ALL ACCESS WINNIPEG
        </div>

        {/* Main headline */}
        <div
          style={{
            fontSize: "88px",
            fontWeight: "900",
            color: "white",
            lineHeight: "0.95",
            marginBottom: "22px",
            letterSpacing: "-3px",
            textTransform: "uppercase",
          }}
        >
          BUILT FOR THE<br />
          <span style={{ color: "#ff007f" }}>COMMUNITY</span>
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "26px",
            color: "rgba(255,255,255,0.55)",
            marginBottom: "44px",
            fontWeight: "500",
            letterSpacing: "0.5px",
          }}
        >
          Safe spaces. Real experiences. Winnipeg, together.
        </div>

        {/* Tags row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {["Community First", "Open to Everyone", "Non-Profit", "100% Winnipeg"].map((tag) => (
            <div
              key={tag}
              style={{
                background: "rgba(255,0,127,0.12)",
                border: "1px solid rgba(255,0,127,0.25)",
                borderRadius: "100px",
                padding: "8px 20px",
                fontSize: "14px",
                fontWeight: "700",
                color: "rgba(255,100,180,0.9)",
                letterSpacing: "1px",
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            right: "60px",
            color: "rgba(255,255,255,0.20)",
            fontSize: "16px",
            fontWeight: "600",
            letterSpacing: "2px",
          }}
        >
          allaccesswinnipeg.ca
        </div>

        {/* Bottom rule */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "3px",
            background: "linear-gradient(to right, transparent, #ff007f 20%, #ff007f 80%, transparent)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
