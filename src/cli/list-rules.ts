import { listRules } from "../rules/index.js";

export type RuleListFormat = "json" | "tsv";

export function renderRuleList(): string {
  const lines = ["ruleId\tseverity\ttitle"];

  for (const rule of listRules()) {
    lines.push(`${rule.id}\t${rule.severity}\t${rule.title}`);
  }

  return lines.join("\n");
}

export function renderRuleListJson(): string {
  return JSON.stringify(listRules(), null, 2);
}
