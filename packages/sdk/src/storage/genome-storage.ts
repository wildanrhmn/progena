import { deserializeGenome, serializeGenome } from "../genome/serialize.js";
import type { Genome, RootHash } from "../genome/types.js";
import type { StorageBackend, UploadResult } from "./types.js";

export class GenomeStorage {
  constructor(private readonly backend: StorageBackend) {}

  async uploadGenome(genome: Genome): Promise<UploadResult> {
    const bytes = serializeGenome(genome);
    return this.backend.upload(bytes);
  }

  async downloadGenome(rootHash: RootHash): Promise<Genome> {
    const bytes = await this.backend.download(rootHash);
    return deserializeGenome(bytes);
  }
}
