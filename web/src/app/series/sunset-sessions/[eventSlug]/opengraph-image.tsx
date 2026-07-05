import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Rooftop Paint & Sip — Sunset Sessions Vol. 01 | ALL ACCESS Winnipeg";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { eventSlug: string };
}) {
  const slug = params.eventSlug;

  // Paint & Sip — Vol. 01
  if (slug === "vol-01") {
    return new ImageResponse(
      (
        <div
          style={{
            background: "#080608",
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
          {/* Warm sunset glow top-right */}
          <div
            style={{
              position: "absolute",
              top: "-160px",
              right: "-120px",
              width: "680px",
              height: "680px",
              background:
                "radial-gradient(circle, rgba(251,146,60,0.20) 0%, rgba(212,175,55,0.10) 40%, transparent 70%)",
              borderRadius: "50%",
            }}
          />
          {/* Deep warm glow bottom-left */}
          <div
            style={{
              position: "absolute",
              bottom: "-140px",
              left: "-80px",
              width: "520px",
              height: "520px",
              background:
                "radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)",
              borderRadius: "50%",
            }}
          />
          {/* Left accent bar — gold */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "4px",
              height: "200px",
              background: "linear-gradient(to bottom, #D4AF37, transparent)",
            }}
          />

          {/* Top-right series label */}
          <div
            style={{
              position: "absolute",
              top: "52px",
              right: "60px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "6px",
            }}
          >
            <div
              style={{
                color: "rgba(212,175,55,0.5)",
                fontSize: "11px",
                fontWeight: "800",
                letterSpacing: "4px",
                textTransform: "uppercase",
              }}
            >
              SUNSET SESSIONS
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.20)",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              VOL. 01
            </div>
          </div>

          {/* Badge */}
          <div
            style={{
              display: "flex",
              background: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: "100px",
              padding: "10px 24px",
              marginBottom: "28px",
              fontSize: "13px",
              fontWeight: "800",
              letterSpacing: "4px",
              color: "#D4AF37",
              textTransform: "uppercase",
            }}
          >
            ALL ACCESS WINNIPEG
          </div>

          {/* Main headline */}
          <div
            style={{
              fontSize: "86px",
              fontWeight: "900",
              color: "white",
              lineHeight: "0.9",
              marginBottom: "8px",
              letterSpacing: "-3px",
              textTransform: "uppercase",
            }}
          >
            ROOFTOP
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "86px",
              fontWeight: "900",
              lineHeight: "0.9",
              marginBottom: "24px",
              letterSpacing: "-3px",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "#D4AF37" }}>PAINT</span>
            <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 16px" }}>&</span>
            <span style={{ color: "white" }}>SIP</span>
          </div>

          {/* Sub */}
          <div
            style={{
              fontSize: "22px",
              color: "rgba(255,255,255,0.45)",
              marginBottom: "44px",
              fontWeight: "500",
              letterSpacing: "0.5px",
            }}
          >
            An evening of art, wine &amp; golden hour — July 31, 2026
          </div>

          {/* Price + details row */}
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <div
              style={{
                fontSize: "52px",
                fontWeight: "900",
                color: "#D4AF37",
                letterSpacing: "-1px",
              }}
            >
              $80
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
                MEMBERS FROM $60 · WINNIPEG ROOFTOP
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.20)",
                  fontSize: "14px",
                  fontWeight: "600",
                  letterSpacing: "2px",
                }}
              >
                allaccesswinnipeg.ca/paintsip
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
                "linear-gradient(to right, transparent, #D4AF37 20%, #D4AF37 80%, transparent)",
            }}
          />
        </div>
      ),
      { ...size }
    );
  }

  // Generic fallback for future Sunset Sessions volumes
  return new ImageResponse(
    (
      <div
        style={{
          background: "#080608",
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
        <div
          style={{
            display: "flex",
            background: "rgba(212,175,55,0.12)",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: "100px",
            padding: "10px 24px",
            marginBottom: "28px",
            fontSize: "13px",
            fontWeight: "800",
            letterSpacing: "4px",
            color: "#D4AF37",
            textTransform: "uppercase",
          }}
        >
          ALL ACCESS WINNIPEG
        </div>
        <div
          style={{
            fontSize: "96px",
            fontWeight: "900",
            color: "white",
            lineHeight: "0.9",
            marginBottom: "24px",
            letterSpacing: "-3px",
            textTransform: "uppercase",
          }}
        >
          SUNSET SESSIONS
        </div>
        <div
          style={{
            fontSize: "22px",
            color: "rgba(255,255,255,0.45)",
            fontWeight: "500",
          }}
        >
          Community events · allaccesswinnipeg.ca
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "3px",
            background:
              "linear-gradient(to right, transparent, #D4AF37 20%, #D4AF37 80%, transparent)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
