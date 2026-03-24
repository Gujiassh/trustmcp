import type { Finding, Rule, ScanFile } from "../core/types.js";

import { broadFilesystemRule } from "./broad-filesystem.js";
import { outboundFetchRule } from "./outbound-fetch.js";
import { shellExecRule } from "./shell-exec.js";

const ALL_RULES: Rule[] = [shellExecRule, outboundFetchRule, broadFilesystemRule];

export interface ListedRule {
  id: string;
  severity: Rule["defaultSeverity"];
  title: string;
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
      title: rule.title
    }));
}
