import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.08em"
        }}
      >
        SP
      </div>
    ),
    {
      width: 512,
      height: 512
    }
  );
}
