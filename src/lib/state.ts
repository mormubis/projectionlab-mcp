import { randomUUID } from "node:crypto";

export interface OperationState {
  tool: string;
  step: number;
  data: Record<string, unknown>;
  createdAt: number;
}

const operations = new Map<string, OperationState>();

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function createOperation(
  tool: string,
  data?: Record<string, unknown>,
): string {
  cleanup();
  const id = randomUUID();
  operations.set(id, {
    tool,
    step: 0,
    data: data ?? {},
    createdAt: Date.now(),
  });
  return id;
}

export function getOperation(requestId: string): OperationState | undefined {
  cleanup();
  return operations.get(requestId);
}

export function advanceOperation(
  requestId: string,
  data?: Record<string, unknown>,
): void {
  const op = operations.get(requestId);
  if (!op) throw new Error(`Unknown operation: ${requestId}`);
  op.step += 1;
  if (data) Object.assign(op.data, data);
}

export function completeOperation(requestId: string): void {
  operations.delete(requestId);
}

function cleanup(): void {
  const now = Date.now();
  for (const [id, op] of operations) {
    if (now - op.createdAt > TTL_MS) {
      operations.delete(id);
    }
  }
}
