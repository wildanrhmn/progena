import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Genome } from "@progena/sdk";

export interface MaterializedWorkspace {
  root: string;
  cleanup: () => Promise<void>;
}

export interface MaterializeOptions {
  genome: Genome;
  rootDir?: string;
  recentMemoryLessons?: string[];
}

const PROGENA_MANIFEST_PATH = "progena.json";
const MEMORY_DIGEST_PATH = "memory/recent-lessons.md";

export async function materializeWorkspace(
  opts: MaterializeOptions
): Promise<MaterializedWorkspace> {
  const root = opts.rootDir ?? (await mkdtemp(join(tmpdir(), "progena-openclaw-")));

  await mkdir(root, { recursive: true });

  for (const [path, content] of Object.entries(opts.genome.workspace)) {
    await writeFileEnsuringParents(join(root, path), content);
  }

  const manifest = {
    version: 1,
    generation: opts.genome.manifest.generation,
    parents: opts.genome.manifest.parents ?? [],
    createdAt: opts.genome.manifest.createdAt,
  };
  await writeFileEnsuringParents(
    join(root, PROGENA_MANIFEST_PATH),
    JSON.stringify(manifest, null, 2)
  );

  if (opts.recentMemoryLessons && opts.recentMemoryLessons.length > 0) {
    const md = [
      "# Recent lessons from past rounds",
      "",
      "These are takeaways you wrote for yourself after previous rounds. Read them before forming your next prediction.",
      "",
      ...opts.recentMemoryLessons.map((l, i) => `${i + 1}. ${l}`),
    ].join("\n");
    await writeFileEnsuringParents(join(root, MEMORY_DIGEST_PATH), md);
  }

  return {
    root,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function writeFileEnsuringParents(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}
