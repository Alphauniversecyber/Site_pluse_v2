import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          padding: "64px 72px",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(59,130,246,0.28), transparent 34%), radial-gradient(circle at bottom right, rgba(148,163,184,0.16), transparent 28%)"
          }}
        />
        <div
          style={{
            display: "flex",
            position: "relative",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center"
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: "-0.05em"
            }}
          >
            SitePulse
          </div>
          <div
            style={{
              marginTop: 20,
              maxWidth: 820,
              fontSize: 34,
              color: "#94a3b8"
            }}
          >
            Turn website audits into paying clients
          </div>
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 24,
            color: "#cbd5e1"
          }}
        >
          trysitepulse.com
        </div>
      </div>
    ),
    size
  );
}
