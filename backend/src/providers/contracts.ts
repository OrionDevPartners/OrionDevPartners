export interface InferenceProvider {
  infer(input: {
    model: string;
    input: unknown;
    sensitivity: "public" | "sensitive";
  }): Promise<unknown>;
}

export interface ObjectStore {
  put(input: {
    key: string;
    content: Uint8Array;
    contentType: string;
  }): Promise<void>;
  get(
    key: string,
  ): Promise<{ content: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

export interface NotificationProvider {
  send(input: {
    recipient: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface DeploymentTarget {
  deploy(input: {
    projectId: string;
    artifact: string;
    version: string;
  }): Promise<{ deploymentId: string }>;
}

export interface SecretSource {
  get(name: string): Promise<string | undefined>;
}
