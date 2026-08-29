import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "4,000+ Community Memories — ALL ACCESS Winnipeg";
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
          padding: "60px 64px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow — pink top-right */}
        <div
          style={{
            position: "absolute",
            top: "-200px",
            right: "-100px",
            width: "700px",
            height: "700px",
            background:
              "radial-gradient(circle, rgba(236,72,153,0.20) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
        {/* Purple glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-80px",
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
        {/* Subtle grid texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Left accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "260px",
            background: "linear-gradient(to bottom, #ec4899, transparent)",
          }}
        />

        {/* Top badge */}
        <div
          style={{
            display: "flex",
            background: "rgba(236,72,153,0.12)",
            border: "1px solid rgba(236,72,153,0.35)",
            borderRadius: "100px",
            padding: "10px 24px",
            marginBottom: "36px",
            fontSize: "13px",
            fontWeight: "800",
            letterSpacing: "4px",
            color: "#ec4899",
            textTransform: "uppercase",
          }}
        >
          ALL ACCESS WINNIPEG
        </div>

        {/* Main count */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "0px",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontSize: "104px",
              fontWeight: "900",
              lineHeight: "1",
              letterSpacing: "-5px",
              color: "#ffffff",
            }}
          >
            4,000
          </span>
          <span
            style={{
              fontSize: "72px",
              fontWeight: "900",
              lineHeight: "1",
              letterSpacing: "-2px",
              color: "#ec4899",
              marginLeft: "4px",
            }}
          >
            +
          </span>
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "6px",
            textTransform: "uppercase",
            marginBottom: "32px",
          }}
        >
          MOMENTS CAPTURED
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "22px",
            fontWeight: "500",
            color: "rgba(255,255,255,0.38)",
            letterSpacing: "0.3px",
          }}
        >
          Winnipeg, you might be in here 👀
        </div>

        {/* Bottom line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            background:
              "linear-gradient(to right, transparent, #ec4899 20%, #a855f7 80%, transparent)",
          }}
        />

        {/* URL watermark */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "64px",
            fontSize: "14px",
            color: "rgba(255,255,255,0.18)",
            letterSpacing: "2px",
            fontWeight: "600",
          }}
        >
          allaccesswinnipeg.ca/memories
        </div>
      </div>
    ),
    { ...size }
  );
}
