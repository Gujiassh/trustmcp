import type { Finding, Rule, ScanFile } from "../core/types.js";

import { broadFilesystemRule } from "./broad-filesystem.js";
import { outboundFetchRule } from "./outbound-fetch.js";
import { shellExecRule } from "./shell-exec.js";

const ALL_RULES: Rule[] = [shellExecRule, outboundFetchRule, broadFilesystemRule];

export function runAllRules(files: ScanFile[]): Finding[] {
  return ALL_RULES.flatMap((rule) => rule.evaluate(files));
}
