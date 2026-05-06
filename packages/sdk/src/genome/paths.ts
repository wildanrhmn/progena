export const SOUL_FILE = "SOUL.md";
export const AGENTS_FILE = "AGENTS.md";
export const TOOLS_FILE = "TOOLS.md";

export const SKILLS_DIR = "skills";
export const MEMORY_DIR = "memory";

export function isSkillPath(path: string): boolean {
  return path.startsWith(`${SKILLS_DIR}/`) && path.endsWith("/SKILL.md");
}

export function isMemoryPath(path: string): boolean {
  return path.startsWith(`${MEMORY_DIR}/`);
}

export function skillNameFromPath(path: string): string | null {
  if (!isSkillPath(path)) return null;
  const segments = path.split("/");
  return segments[1] ?? null;
}
