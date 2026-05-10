"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { LiquidMetal } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

type LiquidMetalBorderProps = {
  children: ReactNode;
  className?: string;
  borderRadius?: number;
  borderWidth?: number;
  colorBack?: string;
  colorTint?: string;
  repetition?: number;
  softness?: number;
  shiftRed?: number;
  shiftBlue?: number;
  distortion?: number;
  contour?: number;
  angle?: number;
  speed?: number;
  scale?: number;
  opacity?: number;
  theme?: "light" | "dark";
};

export function LiquidMetalBorder({
  children,
  className,
  borderRadius = 9999,
  borderWidth = 2,
  colorBack,
  colorTint,
  repetition = 7,
  softness = 0.05,
  shiftRed = 0.6,
  shiftBlue = 0.3,
  distortion = 0.1,
  contour = 0.4,
  angle = 90,
  speed = 0.9,
  scale = 4,
  opacity = 1,
  theme = "dark",
}: LiquidMetalBorderProps) {
  const defaultColorBack = theme === "light" ? "#888888" : "#aaaaac";
  const defaultColorTint = "#ffffff";

  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!!entry?.isIntersecting),
      { rootMargin: "100px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ borderRadius, padding: borderWidth }}
    >
      <div
        className="absolute inset-0 z-0 overflow-hidden"
        style={{ borderRadius, opacity }}
      >
        {isVisible ? (
          <LiquidMetal
            style={{ width: "100%", height: "100%" }}
            colorBack={colorBack ?? defaultColorBack}
            colorTint={colorTint ?? defaultColorTint}
            shape="none"
            repetition={repetition}
            softness={softness}
            shiftRed={shiftRed}
            shiftBlue={shiftBlue}
            distortion={distortion}
            contour={contour}
            angle={angle}
            speed={speed}
            scale={scale}
            fit="cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                theme === "light"
                  ? "linear-gradient(135deg, #d1d5db 0%, #9ca3af 50%, #d1d5db 100%)"
                  : "linear-gradient(135deg, #71717a 0%, #52525b 50%, #71717a 100%)",
            }}
          />
        )}
      </div>

      <div
        className="relative z-10"
        style={{ borderRadius: borderRadius - borderWidth }}
      >
        {children}
      </div>
    </div>
  );
}
