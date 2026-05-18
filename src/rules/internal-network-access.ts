import { createFinding } from "../core/rule-helpers.js";
import type { Finding, Rule, ScanFile } from "../core/types.js";

const NETWORK_REQUEST_PATTERN =
  /\b(?:fetch|axios(?:\.(?:get|post|put|patch|delete|request|head|options))?|https?\.(?:request|get)|got(?:\.(?:get|post|put|patch|delete|stream|head))?|undici\.(?:request|fetch))\s*\(/;
const URL_LITERAL_PATTERN = /["'`](https?:\/\/[^"'`\s)]+)/gi;
const TOOL_CONTROLLED_INTERNAL_TARGET_PATTERN =
  /(?:args|params|input|request|toolInput|toolArgs|resource)\.[A-Za-z0-9_]*(?:internal|localhost|loopback|metadata|admin|private|intranet)[A-Za-z0-9_]*(?:url|endpoint|host|origin|baseUrl)?\b/i;

export const internalNetworkAccessRule: Rule = {
  confidenceGuidance: [
    {
      level: "high",
      reason: "literal-internal-network-target",
      description: "A network request targets a literal local, private, link-local, metadata, .local, or .internal address."
    },
    {
      level: "high",
      reason: "tool-controlled-internal-network-target",
      description: "The destination appears to come from a tool or request field named like an internal, admin, metadata, or private network target."
    }
  ],
  confidenceLevels: ["high"],
  confidenceReasons: ["literal-internal-network-target", "tool-controlled-internal-network-target"],
  defaultSeverity: "high",
  id: "mcp/internal-network-access",
  title: "Internal or local network access capability detected",
  evaluate(files: ScanFile[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      file.lines.forEach((line, index) => {
        if (!NETWORK_REQUEST_PATTERN.test(line)) {
          return;
        }

        const confidenceReason = getConfidenceReason(line);
        if (confidenceReason === null) {
          return;
        }

        findings.push(
          createFinding({
            ruleId: "mcp/internal-network-access",
            severity: "high",
            confidence: "high",
            confidenceReason,
            title: internalNetworkAccessRule.title,
            file: file.relativePath,
            line: index + 1,
            evidence: line,
            whyItMatters:
              "Requests to local, private, or metadata-service targets can reach host or cloud-internal surfaces that ordinary outbound fetch findings do not distinguish.",
            remediation:
              "Avoid internal network destinations by default, require explicit allowlists for needed hosts, and reject tool-controlled local or metadata-service URLs."
          })
        );
      });
    }

    return findings;
  }
};

function getConfidenceReason(line: string): "literal-internal-network-target" | "tool-controlled-internal-network-target" | null {
  if (lineContainsInternalUrlLiteral(line)) {
    return "literal-internal-network-target";
  }

  if (TOOL_CONTROLLED_INTERNAL_TARGET_PATTERN.test(line)) {
    return "tool-controlled-internal-network-target";
  }

  return null;
}

function lineContainsInternalUrlLiteral(line: string): boolean {
  URL_LITERAL_PATTERN.lastIndex = 0;
  for (const match of line.matchAll(URL_LITERAL_PATTERN)) {
    const rawUrl = match[1];
    if (rawUrl !== undefined && isInternalNetworkUrl(rawUrl)) {
      return true;
    }
  }

  return false;
}

function isInternalNetworkUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    return (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      isIpv4InInternalRange(hostname)
    );
  } catch {
    return false;
  }
}

function isIpv4InInternalRange(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const first = octets[0]!;
  const second = octets[1]!;

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
