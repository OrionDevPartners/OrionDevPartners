import type { Queryable } from "./postgres.js";

export type ProjectRecord = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
};

export interface ProjectRepository {
  create(tenantId: string, name: string): Promise<ProjectRecord>;
  findById(tenantId: string, projectId: string): Promise<ProjectRecord | null>;
}

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  created_at: Date;
};

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly db: Queryable) {}

  async create(tenantId: string, name: string): Promise<ProjectRecord> {
    const result = await this.db.query<ProjectRow>(
      `INSERT INTO projects (tenant_id, name)
       VALUES ($1, $2)
       RETURNING id, tenant_id, name, created_at`,
      [tenantId, name],
    );
    return toProject(result.rows[0]!);
  }

  async findById(
    tenantId: string,
    projectId: string,
  ): Promise<ProjectRecord | null> {
    const result = await this.db.query<ProjectRow>(
      `SELECT id, tenant_id, name, created_at
       FROM projects
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, projectId],
    );
    return result.rows[0] ? toProject(result.rows[0]) : null;
  }
}

function toProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    createdAt: row.created_at,
  };
}
