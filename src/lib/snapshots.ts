import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

export interface SnapshotMeta {
  filename: string;
  path: string;
  createdAt: string;
  sizeMB: number;
}

function redactApiKey(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  if (Array.isArray(data)) return data.map(redactApiKey);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (k === "key" || k === "apiKey" || k === "pluginKey") {
      result[k] = "[REDACTED]";
    } else {
      result[k] = redactApiKey(v);
    }
  }
  return result;
}

export async function saveSnapshot(
  data: unknown,
  label?: string,
): Promise<string> {
  await mkdir(config.snapshotsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = label ? `-${label}` : "";
  const filename = `snapshot-${timestamp}${suffix}.json`;
  const filepath = join(config.snapshotsDir, filename);

  const redacted = redactApiKey(data);
  await writeFile(filepath, JSON.stringify(redacted, null, 2), "utf-8");

  return filepath;
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  await mkdir(config.snapshotsDir, { recursive: true });

  const files = await readdir(config.snapshotsDir);
  const snapshots: SnapshotMeta[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const filepath = join(config.snapshotsDir, file);
    const content = await readFile(filepath, "utf-8");
    const sizeBytes = Buffer.byteLength(content, "utf-8");

    // Extract timestamp from filename: snapshot-YYYY-MM-DDTHH-MM-SS-sssZ-label.json
    const match = file.match(
      /^snapshot-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/,
    );
    const createdAt = match
      ? match[1].replace(/(\d{2})-(\d{2})-(\d{3})Z/, "$1:$2:$3Z").replace("T", "T")
      : "unknown";

    snapshots.push({
      filename: file,
      path: filepath,
      createdAt,
      sizeMB: Math.round((sizeBytes / 1024 / 1024) * 100) / 100,
    });
  }

  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadSnapshot(
  filepath: string,
): Promise<unknown> {
  const content = await readFile(filepath, "utf-8");
  return JSON.parse(content);
}
