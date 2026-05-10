import type { ReactNode } from "react";

const CLIP =
  "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className="p-px"
      style={{ clipPath: CLIP, background: "rgba(255,255,255,0.18)" }}
    >
      <div
        className={`relative h-full bg-[#0a0a0a] text-foreground ${className ?? ""}`}
        style={{ clipPath: CLIP }}
      >
        {children}
      </div>
    </div>
  );
}

type BracketBoxProps = {
  children: ReactNode;
  className?: string;
  dotted?: boolean;
};

export function BracketBox({
  children,
  className,
  dotted = true,
}: BracketBoxProps) {
  const dotStyle: React.CSSProperties = dotted
    ? {
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.32) 0.7px, transparent 0.7px)",
        backgroundSize: "6px 6px",
      }
    : {};
  return (
    <div
      className={`relative border border-dashed border-white/22 ${className ?? ""}`}
      style={dotStyle}
    >
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-white/70" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-white/70" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-white/70" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-white/70" />
      {children}
    </div>
  );
}
