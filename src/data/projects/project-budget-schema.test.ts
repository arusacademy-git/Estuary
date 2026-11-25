import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261125090000_add_project_budgets/migration.sql'
  ),
  'utf8'
);

describe('ProjectBudget Prisma schema', () => {
  it('generates a ProjectBudget model related directly to Project', () => {
    const projectBudget = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'ProjectBudget'
    );
    const project = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'Project'
    );

    expect(
      projectBudget?.fields.find((field) => field.name === 'project')
    ).toMatchObject({
      relationFromFields: ['projectId'],
      relationToFields: ['id'],
      type: 'Project',
    });
    expect(
      project?.fields.find((field) => field.name === 'budgets')
    ).toMatchObject({
      isList: true,
      type: 'ProjectBudget',
    });
    expect(projectBudget?.uniqueFields).toContainEqual(['projectId', 'year']);
  });

  it('creates independent yearly budgets with the required indexes and cascade', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "project_budgets_project_id_year_key"'
    );
    expect(migration).toContain(
      'CREATE INDEX "project_budgets_project_id_idx"'
    );
    expect(migration).toContain('CREATE INDEX "project_budgets_year_idx"');
    expect(migration).toContain(
      'FOREIGN KEY ("project_id") REFERENCES "projects"("id")'
    );
    expect(migration).toContain('ON DELETE CASCADE ON UPDATE CASCADE');
    expect(migration).not.toContain('project_manager_assignments');
  });
});
