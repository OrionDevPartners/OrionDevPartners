import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SecretSource } from "./contracts.js";

const secretNamePattern = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

export class MountedFileSecretSource implements SecretSource {
  constructor(private readonly directory: string) {}

  async get(name: string): Promise<string | undefined> {
    if (!secretNamePattern.test(name)) {
      throw new TypeError("Invalid mounted secret name");
    }
    try {
      const value = await readFile(join(this.directory, name), "utf8");
      return value.replace(/\r?\n$/, "");
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }
      throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
