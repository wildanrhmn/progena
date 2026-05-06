import { z } from "zod";

const ROOT_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

export const rootHashSchema = z
  .string()
  .regex(ROOT_HASH_REGEX, "expected a 0x-prefixed 32-byte hex string");

export const genomeManifestSchema = z.object({
  createdAt: z.number().int().nonnegative(),
  generation: z.number().int().nonnegative(),
  parents: z.tuple([rootHashSchema, rootHashSchema]).optional(),
});

export const workspaceFilesSchema = z.record(
  z.string().min(1, "workspace path cannot be empty"),
  z.string()
);

export const genomeSchema = z.object({
  version: z.literal(1),
  manifest: genomeManifestSchema,
  workspace: workspaceFilesSchema,
});

export type RootHash = `0x${string}`;
export type GenomeManifest = z.infer<typeof genomeManifestSchema>;
export type WorkspaceFiles = z.infer<typeof workspaceFilesSchema>;
export type Genome = z.infer<typeof genomeSchema>;

export class GenomeSchemaError extends Error {
  constructor(message: string, public readonly issues?: z.ZodIssue[]) {
    super(message);
    this.name = "GenomeSchemaError";
  }
}

export function validateGenome(input: unknown): Genome {
  const result = genomeSchema.safeParse(input);
  if (!result.success) {
    throw new GenomeSchemaError(
      `invalid genome: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      result.error.issues
    );
  }
  return result.data;
}
