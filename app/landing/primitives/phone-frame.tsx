import type { CSSProperties, ReactNode } from "react";

export function LandingPhoneFrame({
  width = 280,
  tilt = 0,
  children,
  style,
}: Readonly<{
  width?: number;
  tilt?: number;
  children?: ReactNode;
  style?: CSSProperties;
}>) {
  const height = (width * 844) / 390;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        background: "linear-gradient(180deg, #1a1a1c, #0c0c0e)",
        padding: width * 0.027,
        boxShadow:
          "0 40px 80px -30px oklch(0 0 0 / 0.6), 0 12px 30px -12px oklch(0 0 0 / 0.4), inset 0 0 0 1.5px oklch(1 0 0 / 0.08)",
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: width * 0.105,
          background: "var(--surface-canvas)",
        }}
      >
        {/* notch */}
        <div
          aria-hidden
          className="absolute"
          style={{
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.32,
            height: width * 0.06,
            background: "#0c0c0e",
            borderRadius: 999,
            zIndex: 5,
          }}
        />
        {children}
      </div>
    </div>
  );
}
