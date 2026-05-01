import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const config = {
  keyPath:
    process.env.PROJECTIONLAB_KEY_PATH ??
    join(homedir(), ".config", "projectionlab", "key"),

  snapshotsDir:
    process.env.PROJECTIONLAB_SNAPSHOTS_DIR ??
    join(homedir(), ".config", "projectionlab", "snapshots"),

  baseUrl:
    process.env.PROJECTIONLAB_BASE_URL ?? "https://app.projectionlab.com/",
} as const;

export async function readApiKey(): Promise<string> {
  try {
    const raw = await readFile(config.keyPath, "utf-8");
    const key = raw.trim();
    if (!key) throw new Error("API key file is empty");
    return key;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read API key";
    throw new Error(
      `Cannot read ProjectionLab API key from ${config.keyPath}: ${message}. Run pl_setup to configure.`,
    );
  }
}

export async function writeApiKey(key: string): Promise<void> {
  const dir = dirname(config.keyPath);
  await mkdir(dir, { recursive: true });
  await writeFile(config.keyPath, key.trim() + "\n", "utf-8");
  await chmod(config.keyPath, 0o600);
}
