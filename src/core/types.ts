export type Severity = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type SourceType = "local-directory" | "public-github-repo";

export interface Finding {
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
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
  findingCount: number;
  triggeredRuleCount: number;
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
  id: string;
  evaluate(files: ScanFile[]): Finding[];
}
