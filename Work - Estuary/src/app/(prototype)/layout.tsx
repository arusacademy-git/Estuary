import { Suspense } from 'react';

import { PrototypeAppShell } from '@/app/_components/prototype-app-shell';
import { getPrototypeWorkspace } from '@/domain/prototype/get-prototype-workspace';

export default function PrototypeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspacePromise = getPrototypeWorkspace();

  return (
    <Suspense fallback={null}>
      <PrototypeLayoutContent workspacePromise={workspacePromise}>
        {children}
      </PrototypeLayoutContent>
    </Suspense>
  );
}

async function PrototypeLayoutContent({
  workspacePromise,
  children,
}: {
  workspacePromise: ReturnType<typeof getPrototypeWorkspace>;
  children: React.ReactNode;
}) {
  const workspace = await workspacePromise;

  return (
    <PrototypeAppShell
      brand={workspace.brand}
      status={workspace.status}
      users={workspace.users}
    >
      {children}
    </PrototypeAppShell>
  );
}
