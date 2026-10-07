import { z } from "zod";
import type {
  ProjectRepository,
  ProjectRecord,
} from "../persistence/project-repository.js";

const createProjectSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(1).max(200),
});

export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  create(input: unknown): Promise<ProjectRecord> {
    const parsed = createProjectSchema.parse(input);
    return this.projects.create(parsed.tenantId, parsed.name);
  }

  get(tenantId: string, projectId: string): Promise<ProjectRecord | null> {
    return this.projects.findById(tenantId, projectId);
  }
}
