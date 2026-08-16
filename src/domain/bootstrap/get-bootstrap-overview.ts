import { getBootstrapConfig } from '@/data/bootstrap/bootstrap-config-repository';
import type {
  BootstrapConfig,
  BootstrapOverview,
  RuntimeEnvironmentSnapshot,
} from '@/domain/bootstrap/types';
import { getRuntimeSignals, readRuntimeEnvironment } from '@/lib/env';

export function buildBootstrapOverview(
  config: BootstrapConfig,
  runtimeEnvironment: RuntimeEnvironmentSnapshot
): BootstrapOverview {
  return {
    brand: config.brand,
    statusLabel: config.statusLabel,
    headline: config.headline,
    summary: config.summary,
    metrics: config.metrics,
    runtimeSignals: getRuntimeSignals(runtimeEnvironment),
    capabilityColumns: config.capabilityColumns,
    workflowStages: config.workflowStages,
    nextActions: config.nextActions,
    technicalNotes: config.technicalNotes,
    apiPath: '/api/v1/system/bootstrap',
  };
}

export function getBootstrapOverview(): BootstrapOverview {
  return buildBootstrapOverview(
    getBootstrapConfig(),
    readRuntimeEnvironment()
  );
}
