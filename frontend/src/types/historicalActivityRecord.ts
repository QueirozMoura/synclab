import type { Document } from "./document";
import type { Operation } from "./operation";
import type { ClockMap } from "../lib/vectorClock";

export interface HistoricalActivityRecord {
  documentId: string;
  operationId: string;
  operation: Operation;
  before: Document | null;
  after: Document | null;
  vectorClock: ClockMap;
  createdAt: string;
}
