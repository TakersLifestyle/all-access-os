import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ROCAFIESTA — Konfam's First Headline Show | ALL ACCESS Winnipeg";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#050505",
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
        {/* Amber glow top-right */}
        <div
          style={{
            position: "absolute",
            top: "-180px",
            right: "-180px",
            width: "700px",
            height: "700px",
            background:
              "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Amber glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-120px",
            left: "-80px",
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Left accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "220px",
            background: "linear-gradient(to bottom, #f59e0b, transparent)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            background: "rgba(245,158,11,0.15)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: "100px",
            padding: "10px 24px",
            marginBottom: "32px",
            fontSize: "13px",
            fontWeight: "800",
            letterSpacing: "4px",
            color: "#f59e0b",
            textTransform: "uppercase",
          }}
        >
          ALL ACCESS WINNIPEG
        </div>

        {/* Main headline */}
        <div
          style={{
            display: "flex",
            fontSize: "108px",
            fontWeight: "900",
            lineHeight: "0.9",
            marginBottom: "20px",
            letterSpacing: "-4px",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "white" }}>ROCA</span>
          <span style={{ color: "#f59e0b" }}>FIESTA</span>
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "24px",
            color: "rgba(255,255,255,0.50)",
            marginBottom: "44px",
            fontWeight: "500",
            letterSpacing: "0.5px",
          }}
        >
          Konfam&apos;s First Headline Show — September 5, 2026
        </div>

        {/* Price + Details row */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <div
            style={{
              fontSize: "52px",
              fontWeight: "900",
              color: "#f59e0b",
              letterSpacing: "-1px",
            }}
          >
            $15
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "14px",
                fontWeight: "700",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              EARLY BIRD · WINNIPEG, MB · 18+
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.22)",
                fontSize: "14px",
                fontWeight: "600",
                letterSpacing: "2px",
              }}
            >
              allaccesswinnipeg.ca/rocafiesta
            </div>
          </div>
        </div>

        {/* Bottom rule */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "3px",
            background:
              "linear-gradient(to right, transparent, #f59e0b 20%, #f59e0b 80%, transparent)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
