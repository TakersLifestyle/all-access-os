import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ROCAFIESTA — A Spiritual Experience with Konfam | ALL ACCESS Winnipeg";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#050505",
          fontFamily: "sans-serif",
        }}
      >
        {/* Konfam photo — right half */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://allaccesswinnipeg.ca/events/konfam-railing.jpeg"
          alt=""
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "580px",
            height: "630px",
            objectFit: "cover",
            objectPosition: "center 25%",
          }}
        />

        {/* Gradient fade — photo to dark left */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, #050505 42%, rgba(5,5,5,0.82) 58%, rgba(5,5,5,0.10) 100%)",
          }}
        />

        {/* Amber glow behind text */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "-80px",
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)",
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
            height: "240px",
            background: "linear-gradient(to bottom, #f59e0b, transparent)",
          }}
        />

        {/* Text content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "56px 60px",
            width: "660px",
            height: "100%",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: "100px",
              padding: "9px 22px",
              marginBottom: "28px",
              fontSize: "12px",
              fontWeight: "800",
              letterSpacing: "4px",
              color: "#f59e0b",
              textTransform: "uppercase",
              width: "fit-content",
            }}
          >
            ALL ACCESS WINNIPEG
          </div>

          {/* ROCAFIESTA */}
          <div
            style={{
              display: "flex",
              fontSize: "96px",
              fontWeight: "900",
              lineHeight: "0.88",
              letterSpacing: "-4px",
              textTransform: "uppercase",
              marginBottom: "20px",
            }}
          >
            <span style={{ color: "#ffffff" }}>ROCA</span>
            <span style={{ color: "#f59e0b" }}>FIESTA</span>
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: "18px",
              color: "rgba(255,255,255,0.55)",
              fontWeight: "500",
              marginBottom: "32px",
              letterSpacing: "0.3px",
            }}
          >
            A Spiritual Experience with Konfam
          </div>

          {/* Date + details */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "rgba(255,255,255,0.30)",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              SEP 5, 2026 · WINNIPEG · 18+
            </div>
          </div>
        </div>

        {/* Bottom amber rule */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            background:
              "linear-gradient(to right, #f59e0b 0%, #f59e0b 50%, transparent 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
