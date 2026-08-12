import { getPrototypeConfig } from '@/data/prototype/prototype-config-repository';
import { prototypeTemplateCards } from '@/data/prototype/prototype-app-data';
import { getPrototypeState } from '@/data/prototype/prototype-state-repository';
import type { PrototypeWorkspace } from '@/domain/prototype/types';
import { getRuntimeSignals, readRuntimeEnvironment } from '@/lib/env';

export async function getPrototypeWorkspace(): Promise<PrototypeWorkspace> {
  const state = await getPrototypeState();

  return {
    ...getPrototypeConfig(),
    vouchers: state.vouchers,
    notifications: state.notifications,
    exports: state.exports,
    templateCards: prototypeTemplateCards,
    runtimeSignals: getRuntimeSignals(readRuntimeEnvironment()),
  };
}
