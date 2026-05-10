type SectionHeaderProps = {
  eyebrow: string;
};

export function SectionHeader({ eyebrow }: SectionHeaderProps) {
  return (
    <div className="mb-10 flex items-center gap-3 border-y border-foreground/12 py-2">
      <span
        className="h-2.5 w-2.5 rotate-45 border border-foreground/70"
        aria-hidden
      />
      <span className="text-xs uppercase tracking-[0.18em] text-foreground/75">
        {eyebrow}
      </span>
      <div className="flex flex-1 flex-col gap-2 opacity-70" aria-hidden>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-px"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.42) 1px, transparent 1px)",
              backgroundSize: "8px 2px",
              backgroundRepeat: "repeat-x",
            }}
          />
        ))}
      </div>
    </div>
  );
}
