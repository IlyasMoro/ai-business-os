import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "16px 40px",
            borderRadius: 16,
            border: "2px solid rgba(251,191,36,0.4)",
            background: "rgba(251,191,36,0.15)",
            color: "#fbbf24",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          AIBOS
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 34,
            color: "#cbd5e1",
            textAlign: "center",
            maxWidth: 920,
          }}
        >
          The all in one AI powered platform for running your business
        </div>
      </div>
    ),
    { ...size }
  );
}
