"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { LiquidMetalBorder } from "./liquid-metal-border";
import { cn } from "@/lib/utils";

type LiquidCtaButtonProps = {
  children: ReactNode;
  className?: string;
  theme?: "light" | "dark";
  showArrow?: boolean;
};

export function LiquidCtaButton({
  children,
  className,
  theme = "dark",
  showArrow = true,
}: LiquidCtaButtonProps) {
  const isLight = theme === "light";
  return (
    <span
      className={cn(
        "group inline-block transition-transform duration-300 hover:scale-105 active:scale-95",
        className
      )}
    >
      <span
        className={cn(
          "block rounded-full",
          isLight && "shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
        )}
      >
        <LiquidMetalBorder
          borderRadius={9999}
          borderWidth={2}
          theme={theme}
          opacity={1}
          speed={1.2}
          scale={3}
        >
          <span
            className={cn(
              "flex items-center gap-2 rounded-full px-6 py-3",
              isLight
                ? "bg-gradient-to-b from-zinc-100 via-zinc-200 to-zinc-300"
                : "bg-gradient-to-b from-zinc-800 to-zinc-900"
            )}
          >
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                isLight ? "text-zinc-700" : "text-zinc-100"
              )}
            >
              {children}
            </span>
            {showArrow && (
              <ArrowRight
                size={18}
                weight="bold"
                className={cn(
                  "transition-transform duration-300 group-hover:translate-x-1",
                  isLight ? "text-zinc-700" : "text-zinc-100"
                )}
              />
            )}
          </span>
        </LiquidMetalBorder>
      </span>
    </span>
  );
}
