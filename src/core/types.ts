export type Severity = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type SourceType = "local-directory" | "public-github-repo";

export interface ConfidenceGuidance {
  level: Confidence;
  reason: string;
  description: string;
}

export interface Finding {
  fingerprint: string;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  confidenceReason?: string;
  title: string;
  file: string;
  line?: number;
  evidence: string;
  whyItMatters: string;
  remediation: string;
}

export interface AuditTarget {
  input: string;
  displayName: string;
  sourceType: SourceType;
  resolvedRef?: string;
}

export interface AuditSummary {
  baselineApplied: boolean;
  findingCount: number;
  newFindingCount: number;
  gatedFindingCount: number;
  triggeredRuleCount: number;
  newTriggeredRuleCount: number;
  gatedTriggeredRuleCount: number;
  severityCounts: {
    low: number;
    medium: number;
    high: number;
  };
  newSeverityCounts: {
    low: number;
    medium: number;
    high: number;
  };
  gatedSeverityCounts: {
    low: number;
    medium: number;
    high: number;
  };
  message: string;
}

export interface AuditReport {
  tool: {
    name: "TrustMCP";
    version: string;
  };
  target: AuditTarget;
  limitations: string[];
  summary: AuditSummary;
  findings: Finding[];
  newFindings: Finding[];
}

export interface BaselineEntry {
  fingerprint?: string;
  ruleId: string;
  file: string;
  line?: number;
}

export interface AuditOptions {
  ignoreRules?: string[];
  ignorePaths?: string[];
  baselineEntries?: BaselineEntry[];
}

export interface ScanFile {
  absolutePath: string;
  relativePath: string;
  content: string;
  lines: string[];
}

export interface MaterializedSource {
  rootDir: string;
  target: AuditTarget;
  cleanup?: () => Promise<void>;
}

export interface Rule {
  defaultSeverity: Severity;
  id: string;
  title: string;
  confidenceLevels?: Confidence[];
  confidenceReasons?: string[];
  confidenceGuidance?: ConfidenceGuidance[];
  evaluate(files: ScanFile[]): Finding[];
}
