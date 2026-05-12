import type { SVGProps } from "react";

type ProgenaMarkProps = SVGProps<SVGSVGElement> & { size?: number };

export function ProgenaMark({ size = 24, ...rest }: ProgenaMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden
      {...rest}
    >
      <path d="M 3 12 L 8 4 L 11 7 L 11 17 L 8 20 Z" />
      <path d="M 21 12 L 16 4 L 13 7 L 13 17 L 16 20 Z" />
    </svg>
  );
}
