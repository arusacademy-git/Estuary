import { describe, expect, it } from 'vitest';

import { getPrototypeWorkspace } from '@/domain/prototype/get-prototype-workspace';

describe('getPrototypeWorkspace', () => {
  it('exposes configurable workflow policy and source artifacts', async () => {
    const workspace = await getPrototypeWorkspace();

    expect(workspace.workflowPolicy.financeAdminOverride).toBe(true);
    expect(workspace.workflowPolicy.selfApprovalToggleModes).toContain(
      'Require another director'
    );
    expect(workspace.sourceArtifacts).toContain(
      '(PV) Payment Voucher Operating System Guidelines.pdf'
    );
  });
});
