import type { Finding, Rule, ScanFile } from "../core/types.js";

import { archiveExtractRule } from "./archive-extract.js";
import { broadFilesystemRule } from "./broad-filesystem.js";
import { downloadWriteExecRule } from "./download-write-exec.js";
import { dynamicCodeExecRule } from "./dynamic-code-exec.js";
import { envSecretExposureRule } from "./env-secret-exposure.js";
import { localServiceBindingRule } from "./local-service-binding.js";
import { outboundFetchRule } from "./outbound-fetch.js";
import { scriptRunnerExecRule } from "./script-runner-exec.js";
import { subprocessNetworkExfilRule } from "./subprocess-network-exfil.js";
import { sensitiveLocalDataRule } from "./sensitive-local-data.js";
import { shellExecRule } from "./shell-exec.js";
import { toolMetadataRiskRule } from "./tool-metadata-risk.js";

const ALL_RULES: Rule[] = [
  shellExecRule,
  scriptRunnerExecRule,
  outboundFetchRule,
  archiveExtractRule,
  broadFilesystemRule,
  downloadWriteExecRule,
  dynamicCodeExecRule,
  envSecretExposureRule,
  localServiceBindingRule,
  toolMetadataRiskRule,
  subprocessNetworkExfilRule,
  sensitiveLocalDataRule
];

export interface ListedRule {
  id: string;
  severity: Rule["defaultSeverity"];
  title: string;
  confidenceLevels?: Rule["confidenceLevels"];
  confidenceReasons?: Rule["confidenceReasons"];
  confidenceGuidance?: Rule["confidenceGuidance"];
}

export function runAllRules(files: ScanFile[]): Finding[] {
  return ALL_RULES.flatMap((rule) => rule.evaluate(files));
}

export function listRules(): ListedRule[] {
  return [...ALL_RULES]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((rule) => ({
      id: rule.id,
      severity: rule.defaultSeverity,
      title: rule.title,
      ...(rule.confidenceLevels === undefined ? {} : { confidenceLevels: rule.confidenceLevels }),
      ...(rule.confidenceReasons === undefined ? {} : { confidenceReasons: rule.confidenceReasons }),
      ...(rule.confidenceGuidance === undefined ? {} : { confidenceGuidance: rule.confidenceGuidance })
    }));
}
