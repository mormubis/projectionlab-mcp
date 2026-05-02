import { mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const config = {
  snapshotsDir:
    process.env.PROJECTIONLAB_SNAPSHOTS_DIR ??
    join(homedir(), ".config", "projectionlab", "snapshots"),

  baseUrl:
    process.env.PROJECTIONLAB_BASE_URL ?? "https://app.projectionlab.com/",
} as const;
