import { bootstrapConfig } from '@/data/bootstrap/bootstrap-config';
import type { BootstrapConfig } from '@/domain/bootstrap/types';

export function getBootstrapConfig(): BootstrapConfig {
  return bootstrapConfig;
}
