export interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export type SectionType = 'text' | 'list' | 'swot';

export interface ResultSectionConfig {
  key: string;
  title: string;
  type: SectionType;
}

export interface CompetitorResult {
  workflow: 'competitors';
  niche: string;
  swot: SwotData;
  advantages: string[];
  offer: string;
  recommendations: string[];
}

export interface LegalResult {
  workflow: 'legal';
  summary: string;
  risks: string[];
  redFlags: string[];
  recommendations: string[];
}

export interface AnalyticsResult {
  workflow: 'analytics';
  patterns: string[];
  anomalies: string[];
  insights: string[];
  recommendations: string[];
}

export type WorkflowStructuredResult =
  | CompetitorResult
  | LegalResult
  | AnalyticsResult
  | (Record<string, unknown> & { workflow?: string });

export interface WorkflowProgressDto {
  currentStage: number;
  totalStages: number;
  stageName: string;
  progress: number;
}

export interface WorkflowRunResult {
  workflow: string;
  workflowSlug?: string;
  result: WorkflowStructuredResult;
  reply: string;
  report?: string;
  sections: ResultSectionConfig[];
  steps?: string[];
  stepIds?: string[];
  progress?: WorkflowProgressDto;
  engineVersion?: string;
}
