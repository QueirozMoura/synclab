import type { DocumentSnapshot } from "../../../types/sync.js";
import type { DocumentSnapshotRepository } from "../../../domain/document-operations/DocumentSnapshotRepository.js";
import { DocumentSnapshotSerializer } from "./DocumentSnapshotSerializer.js";

/**
 * Implementação em memória de DocumentSnapshotRepository.
 *
 * Usada para desenvolvimento e testes. Não persiste dados entre reinícios.
 */
export class InMemoryDocumentSnapshotRepository implements DocumentSnapshotRepository {
  private readonly snapshots: Map<string, DocumentSnapshot> = new Map();
  private readonly serializer = new DocumentSnapshotSerializer();

  async save(snapshot: DocumentSnapshot): Promise<void> {
    await this.saveMany([snapshot]);
  }

  async saveMany(snapshots: readonly DocumentSnapshot[]): Promise<void> {
    for (const snapshot of snapshots) {
      const existing = this.snapshots.get(snapshot.documentId);

      if (!existing) {
        this.snapshots.set(snapshot.documentId, this.cloneSnapshot(snapshot));
        continue;
      }

      const newUpdatedAt = new Date(snapshot.updatedAt).getTime();
      const existingUpdatedAt = new Date(existing.updatedAt).getTime();

      if (newUpdatedAt > existingUpdatedAt) {
        this.snapshots.set(snapshot.documentId, this.cloneSnapshot(snapshot));
      }
    }
  }

  async getByDocumentId(documentId: string): Promise<DocumentSnapshot | undefined> {
    const snapshot = this.snapshots.get(documentId);
    return snapshot ? this.cloneSnapshot(snapshot) : undefined;
  }

  async getAll(): Promise<readonly DocumentSnapshot[]> {
    return Array.from(this.snapshots.values()).map((s) => this.cloneSnapshot(s));
  }

  async has(documentId: string): Promise<boolean> {
    return this.snapshots.has(documentId);
  }

  async count(): Promise<number> {
    return this.snapshots.size;
  }

  async delete(documentId: string): Promise<void> {
    this.snapshots.delete(documentId);
  }

  private cloneSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
    const serialized = this.serializer.serialize(snapshot);
    return this.serializer.deserialize(serialized);
  }
}