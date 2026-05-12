export function prettifySkillName(raw: string): string {
  if (!raw) return raw;
  const stripped = raw.replace(/^earned-/, "");
  if (stripped.length === 0) return raw;
  const spaced = stripped.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
