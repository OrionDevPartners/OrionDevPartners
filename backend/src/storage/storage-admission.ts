import { AppError, DependencyUnavailableError } from "../shared/errors.js";

export interface StorageCapacitySource {
  availableBytes(): Promise<number | null>;
}

export interface StorageAdmission {
  assertCanAccept(bytes: number): Promise<void>;
}

export class CapacityStorageAdmission implements StorageAdmission {
  constructor(
    private readonly capacity: StorageCapacitySource,
    private readonly maxUploadBytes: number,
  ) {}

  async assertCanAccept(bytes: number): Promise<void> {
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new AppError("INVALID_REQUEST", "Upload size is invalid");
    }
    if (bytes > this.maxUploadBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "Upload exceeds the configured limit",
      );
    }
    let available: number | null;
    try {
      available = await this.capacity.availableBytes();
    } catch {
      throw new DependencyUnavailableError(
        "Storage capacity cannot be established",
      );
    }
    if (
      available === null ||
      !Number.isSafeInteger(available) ||
      available < bytes
    ) {
      throw new AppError(
        "DEPENDENCY_UNAVAILABLE",
        "Storage capacity cannot be established",
      );
    }
  }
}
