export type RuntimeStatus = 'ready' | 'pending';

export type PrototypeMetric = {
  label: string;
  value: string;
  detail: string;
};

export type RuntimeSignal = {
  label: string;
  status: RuntimeStatus;
  detail: string;
};

export type CapabilityItem = {
  label: string;
  detail: string;
};

export type CapabilityColumn = {
  eyebrow: string;
  title: string;
  items: CapabilityItem[];
};

export type WorkflowStage = {
  code: string;
  title: string;
  detail: string;
};

export type BootstrapConfig = {
  brand: string;
  statusLabel: string;
  headline: string;
  summary: string;
  metrics: PrototypeMetric[];
  capabilityColumns: CapabilityColumn[];
  workflowStages: WorkflowStage[];
  nextActions: string[];
  technicalNotes: string[];
};

export type RuntimeEnvironmentSnapshot = {
  databaseUrlConfigured: boolean;
  directUrlConfigured: boolean;
  nextAuthUrlConfigured: boolean;
  nextAuthSecretConfigured: boolean;
  googleOauthConfigured: boolean;
  awsSesConfigured: boolean;
  awsS3Configured: boolean;
};

export type BootstrapOverview = {
  brand: string;
  statusLabel: string;
  headline: string;
  summary: string;
  metrics: PrototypeMetric[];
  runtimeSignals: RuntimeSignal[];
  capabilityColumns: CapabilityColumn[];
  workflowStages: WorkflowStage[];
  nextActions: string[];
  technicalNotes: string[];
  apiPath: string;
};
