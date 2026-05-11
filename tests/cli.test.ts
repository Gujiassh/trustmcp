import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AuditReport, Severity } from "../src/core/types.js";
import { validateNodeRuntimeVersion } from "../src/cli/node-runtime.js";
import { loadCliConfig } from "../src/cli/config.js";
import { TRUSTMCP_VERSION } from "../src/core/version.js";
import { parseArguments, resolveCliOptions, runCli } from "../src/cli/main.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("parseArguments", () => {
  it("parses --fail-on with a separate severity argument", () => {
    expect(parseArguments(["./fixtures/local-risky", "--fail-on", "medium"])).toEqual({
      target: "./fixtures/local-risky",
      failOn: "medium"
    });
  });

  it("parses --fail-on=value alongside scan and format", () => {
    expect(parseArguments(["scan", "./fixtures/local-risky", "--format", "json", "--fail-on=high"])).toEqual({
      target: "./fixtures/local-risky",
      format: "json",
      failOn: "high"
    });
  });

  it("parses markdown output format", () => {
    expect(parseArguments(["gh:modelcontextprotocol/servers", "--format", "markdown"])).toEqual({
      target: "gh:modelcontextprotocol/servers",
      format: "markdown"
    });
  });

  it("parses SARIF output format", () => {
    expect(parseArguments(["gh:modelcontextprotocol/servers", "--format", "sarif"])).toEqual({
      target: "gh:modelcontextprotocol/servers",
      format: "sarif"
    });
  });

  it("parses --output-file in both supported forms", () => {
    expect(parseArguments(["./fixtures/local-risky", "--output-file", "report.md"])).toEqual({
      target: "./fixtures/local-risky",
      outputFile: "report.md"
    });
    expect(parseArguments(["./fixtures/local-risky", "--output-file=report.json", "--format", "json"])).toEqual({
      target: "./fixtures/local-risky",
      format: "json",
      outputFile: "report.json"
    });
  });

  it("parses --config in both supported forms", () => {
    expect(parseArguments(["./fixtures/local-risky", "--config", "trustmcp.config.json"])).toEqual({
      target: "./fixtures/local-risky",
      configFile: "trustmcp.config.json"
    });
    expect(parseArguments(["./fixtures/local-risky", "--config=trustmcp.config.json", "--format", "json"])).toEqual({
      target: "./fixtures/local-risky",
      configFile: "trustmcp.config.json",
      format: "json"
    });
  });

  it("parses --summary-only as a boolean flag", () => {
    expect(parseArguments(["gh:modelcontextprotocol/servers", "--summary-only", "--format", "markdown"])).toEqual({
      target: "gh:modelcontextprotocol/servers",
      format: "markdown",
      summaryOnly: true
    });
  });

  it("parses init-config with the default output path", () => {
    expect(parseArguments(["init-config"])).toEqual({
      initConfig: true,
      outputPath: "trustmcp.config.json"
    });
  });

  it("parses init-config with an explicit output path", () => {
    expect(parseArguments(["init-config", "configs/trustmcp.config.json"])).toEqual({
      initConfig: true,
      outputPath: "configs/trustmcp.config.json"
    });
  });

  it("parses doctor with target and optional config", () => {
    expect(parseArguments(["doctor", "gh:modelcontextprotocol/servers"])).toEqual({
      doctor: true,
      format: "text",
      target: "gh:modelcontextprotocol/servers"
    });
    expect(parseArguments(["doctor", "./fixtures/local-risky", "--config", "trustmcp.config.json"])).toEqual({
      doctor: true,
      format: "text",
      target: "./fixtures/local-risky",
      configFile: "trustmcp.config.json"
    });
  });

  it("parses doctor JSON entry points", () => {
    expect(parseArguments(["doctor", "gh:modelcontextprotocol/servers", "--json"])).toEqual({
      doctor: true,
      format: "json",
      target: "gh:modelcontextprotocol/servers"
    });
    expect(parseArguments(["doctor", "./fixtures/local-risky", "--format", "json"])).toEqual({
      doctor: true,
      format: "json",
      target: "./fixtures/local-risky"
    });
  });

  it("parses doctor output-file entry points", () => {
    expect(parseArguments(["doctor", "./fixtures/local-risky", "--output-file", "doctor.txt"])).toEqual({
      doctor: true,
      format: "text",
      target: "./fixtures/local-risky",
      outputFile: "doctor.txt"
    });

    expect(parseArguments(["doctor", "./fixtures/local-risky", "--json", "--output-file=doctor.json"])).toEqual({
      doctor: true,
      format: "json",
      target: "./fixtures/local-risky",
      outputFile: "doctor.json"
    });
  });

  it("parses list-rules with no extra arguments", () => {
    expect(parseArguments(["list-rules"])).toEqual({
      listRules: true,
      format: "tsv"
    });
  });

  it("parses list-rules JSON entry points", () => {
    expect(parseArguments(["list-rules", "--json"])).toEqual({
      listRules: true,
      format: "json"
    });
    expect(parseArguments(["list-rules", "--format", "json"])).toEqual({
      listRules: true,
      format: "json"
    });
  });

  it("parses list-rules output-file entry points", () => {
    expect(parseArguments(["list-rules", "--output-file", "rules.tsv"])).toEqual({
      listRules: true,
      format: "tsv",
      outputFile: "rules.tsv"
    });

    expect(parseArguments(["list-rules", "--json", "--output-file=rules.json"])).toEqual({
      listRules: true,
      format: "json",
      outputFile: "rules.json"
    });
  });

  it("parses version entry points", () => {
    expect(parseArguments(["--version"])).toEqual({ version: true });
    expect(parseArguments(["-v"])).toEqual({ version: true });
    expect(parseArguments(["version"])).toEqual({ version: true });
  });

  it("rejects invalid format values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--format", "html"]))
      .toThrowError("--format expects one of: text, json, markdown, sarif.");
  });

  it("rejects missing --config values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--config"]))
      .toThrowError("--config expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--config", "--format", "json"]))
      .toThrowError("--config expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--config", "   "]))
      .toThrowError("--config expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--config=   "]))
      .toThrowError("--config expects a file path.");
  });

  it("rejects missing --output-file values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--output-file"]))
      .toThrowError("--output-file expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--output-file", "--format", "json"]))
      .toThrowError("--output-file expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--output-file", "   "]))
      .toThrowError("--output-file expects a file path.");
    expect(() => parseArguments(["./fixtures/local-risky", "--output-file=   "]))
      .toThrowError("--output-file expects a file path.");
  });

  it("rejects invalid --fail-on values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--fail-on", "critical"]))
      .toThrowError("--fail-on expects one of: low, medium, high.");
  });

  it("rejects missing --fail-on values", () => {
    expect(() => parseArguments(["./fixtures/local-risky", "--fail-on"]))
      .toThrowError("--fail-on expects one of: low, medium, high.");
  });

  it("rejects extra init-config positional arguments", () => {
    expect(() => parseArguments(["init-config", "one.json", "two.json"]))
      .toThrowError("init-config accepts at most one optional output path.");
  });

  it("rejects extra doctor positional arguments", () => {
    expect(() => parseArguments(["doctor", "one", "two"]))
      .toThrowError("doctor accepts exactly one target: a local directory, GitHub repository URL, or gh:owner/repo, optionally with an explicit ref.");
  });

  it("rejects blank target arguments", () => {
    expect(() => parseArguments(["   "]))
      .toThrowError("Target must not be blank. Provide a local directory or a public GitHub repository URL.");
    expect(() => parseArguments(["doctor", "   "]))
      .toThrowError("doctor target must not be blank.");
  });

  it("rejects invalid doctor format values", () => {
    expect(() => parseArguments(["doctor", "./fixtures/local-risky", "--format", "markdown"]))
      .toThrowError("doctor --format expects one of: text, json.");
  });

  it("rejects blank doctor path-like option values", () => {
    expect(() => parseArguments(["doctor", "./fixtures/local-risky", "--config", "   "]))
      .toThrowError("--config expects a file path.");
    expect(() => parseArguments(["doctor", "./fixtures/local-risky", "--config=   "]))
      .toThrowError("--config expects a file path.");
    expect(() => parseArguments(["doctor", "./fixtures/local-risky", "--output-file", "   "]))
      .toThrowError("doctor --output-file expects a file path.");
    expect(() => parseArguments(["doctor", "./fixtures/local-risky", "--output-file=   "]))
      .toThrowError("doctor --output-file expects a file path.");
  });

  it("rejects extra list-rules arguments", () => {
    expect(() => parseArguments(["list-rules", "extra"]))
      .toThrowError("list-rules does not accept additional arguments.");
  });

  it("rejects invalid list-rules format values", () => {
    expect(() => parseArguments(["list-rules", "--format", "markdown"]))
      .toThrowError("list-rules --format expects one of: tsv, json.");
  });

  it("rejects blank list-rules output-file values", () => {
    expect(() => parseArguments(["list-rules", "--output-file", "   "]))
      .toThrowError("list-rules --output-file expects a file path.");
    expect(() => parseArguments(["list-rules", "--output-file=   "]))
      .toThrowError("list-rules --output-file expects a file path.");
  });

  it("rejects extra version arguments", () => {
    expect(() => parseArguments(["version", "extra"]))
      .toThrowError("version does not accept additional arguments.");
    expect(() => parseArguments(["--version", "extra"]))
      .toThrowError("version does not accept additional arguments.");
  });
});

describe("runCli exit thresholds", () => {
  it("keeps current exit behavior when --fail-on is omitted", async () => {
    const stdout: string[] = [];
    const exitCode = await runCli(["./fixtures/local-risky"], {
      auditTarget: async () => createReport("local-directory", ["high"]),
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("Shell execution capability detected");
  });

  it("returns exit code 2 when a local finding meets the threshold", async () => {
    const exitCode = await runCli(["./fixtures/local-risky", "--fail-on", "high"], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter([])
    });

    expect(exitCode).toBe(2);
  });

  it("returns exit code 2 when a GitHub finding meets the threshold", async () => {
    const exitCode = await runCli([
      "https://github.com/example/risky-mcp",
      "--format",
      "json",
      "--fail-on",
      "medium"
    ], {
      auditTarget: async () => createReport("public-github-repo", ["medium"]),
      stdout: createWriter([])
    });

    expect(exitCode).toBe(2);
  });

  it("returns exit code 0 when findings stay below the threshold", async () => {
    const exitCode = await runCli(["./fixtures/local-risky", "--fail-on", "high"], {
      auditTarget: async () => createReport("local-directory", ["medium", "low"]),
      stdout: createWriter([])
    });

    expect(exitCode).toBe(0);
  });

  it("writes the rendered report to an explicit file path while preserving stdout", async () => {
    const outputFile = await createTempFilePath("trustmcp-report.md");
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--format",
      "markdown",
      "--output-file",
      outputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter(stdout)
    });

    const fileContent = await readFile(outputFile, "utf8");

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("# TrustMCP Report");
    expect(fileContent).toContain("# TrustMCP Report");
    expect(fileContent).toContain("Shell execution capability detected");
  });

  it("renders deterministic SARIF through the CLI and writes it to disk", async () => {
    const outputFile = await createTempFilePath("trustmcp-report.sarif");
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--format",
      "sarif",
      "--output-file",
      outputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter(stdout)
    });

    const stdoutContent = stdout.join("");
    const fileContent = await readFile(outputFile, "utf8");
    const parsed = JSON.parse(stdoutContent) as {
      version: string;
      runs: Array<{ results: Array<{ ruleId: string; partialFingerprints?: Record<string, string>; properties?: Record<string, unknown> }> }>;
    };

    expect(exitCode).toBe(0);
    expect(stdoutContent).toBe(fileContent);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0]?.results).toHaveLength(2);
    expect(parsed.runs[0]?.results[0]?.ruleId).toBe("rule-1");
    expect(parsed.runs[0]?.results[0]?.partialFingerprints?.primaryLocationLineHash).toBe("rule-1|src/example-1.ts|evidence-1");
    expect(parsed.runs[0]?.results[0]?.properties?.baselineApplied).toBe(false);
    expect(parsed.runs[0]?.results[0]?.properties?.isNewFinding).toBe(true);
    expect(parsed.runs[0]?.results[0]?.properties?.isGatedFinding).toBe(true);
  });

  it("emits only the compact text summary while preserving fail-on behavior", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--summary-only",
      "--fail-on",
      "high"
    ], {
      auditTarget: async () => createReport("local-directory", ["high", "medium"]),
      stdout: createWriter(stdout)
    });

    const output = stdout.join("");
    expect(exitCode).toBe(2);
    expect(output).toContain("Summary: 2 finding(s) across 2 rule(s). Static heuristics only.");
    expect(output).not.toContain("Rule:");
    expect(output).not.toContain("Shell execution capability detected");
  });

  it("emits compact json summary-only output for a no-findings report", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-clean",
      "--summary-only",
      "--format",
      "json"
    ], {
      auditTarget: async () => createReport("local-directory", []),
      stdout: createWriter(stdout)
    });

    const parsed = JSON.parse(stdout.join("")) as {
      summary: { findingCount: number; message: string };
      findings?: unknown;
    };

    expect(exitCode).toBe(0);
    expect(parsed.summary.findingCount).toBe(0);
    expect(parsed.summary.message).toContain("No matching rules were triggered.");
    expect("findings" in parsed).toBe(false);
  });

  it("applies supported defaults from a config file", async () => {
    const reportPath = await createTempFilePath("report-from-config.md");
    const configFile = await createConfigFile(
      JSON.stringify({
        format: "markdown",
        "fail-on": "medium",
        "summary-only": true,
        "output-file": reportPath
      })
    );
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => createReport("local-directory", ["medium"]),
      stdout: createWriter(stdout)
    });

    const fileContent = await readFile(reportPath, "utf8");
    expect(exitCode).toBe(2);
    expect(stdout.join("")).toContain("# TrustMCP Summary");
    expect(fileContent).toContain("# TrustMCP Summary");
    expect(fileContent).not.toContain("## Findings");
  });

  it("loads ignore rules and paths from a config file", async () => {
    const configFile = await createConfigFile(
      JSON.stringify({
        "ignore-rules": ["mcp/shell-exec"],
        "ignore-paths": ["src/vendor"]
      })
    );

    const config = await loadCliConfig(configFile);
    expect(config.ignoreRules).toEqual(["mcp/shell-exec"]);
    expect(config.ignorePaths).toEqual(["src/vendor"]);
  });

  it("honors baseline files passed via the CLI", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(
      [
        "./fixtures/local-risky",
        "--fail-on",
        "high",
        "--baseline-file",
        "fixtures/baseline-local-risky.json"
      ],
      {
        stdout: createWriter(stdout)
      }
    );

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("No new findings.");
  });

  it("treats an empty baseline file as active baseline gating", async () => {
    const baselineFile = await createTempFilePath("trustmcp-empty.baseline.json");
    await writeFile(baselineFile, "[]", "utf8");
    const stdout: string[] = [];

    const exitCode = await runCli(
      [
        "./fixtures/local-risky",
        "--fail-on",
        "high",
        "--baseline-file",
        baselineFile
      ],
      {
        stdout: createWriter(stdout)
      }
    );

    expect(exitCode).toBe(2);
    expect(stdout.join("")).toContain("21 new finding(s) across 12 rule(s).");
  });

  it("writes current findings to a baseline-output file", async () => {
    const baselineOutput = await createTempFilePath("trustmcp.baseline.json");

    const exitCode = await runCli(
      [
        "./fixtures/local-risky",
        "--baseline-output",
        baselineOutput
      ],
      {
        stdout: createWriter([])
      }
    );

    expect(exitCode).toBe(0);
    expect(await readFile(baselineOutput, "utf8")).toBe(`${JSON.stringify([
      {
        fingerprint: "mcp/broad-filesystem|src/files.ts|return fs.readdir(input.path, { recursive: true }); }",
        ruleId: "mcp/broad-filesystem",
        file: "src/files.ts",
        line: 4
      },
      {
        fingerprint: "mcp/broad-filesystem|src/mutation.ts|return fs.rm(input.targetPath, { recursive: true, force: true }); }",
        ruleId: "mcp/broad-filesystem",
        file: "src/mutation.ts",
        line: 4
      },
      {
        fingerprint: "mcp/broad-filesystem|src/secrets.ts|return fs.readFile(`${process.env.HOME}/.aws/credentials`, \"utf8\"); }",
        ruleId: "mcp/broad-filesystem",
        file: "src/secrets.ts",
        line: 4
      },
      {
        fingerprint: "mcp/download-write-exec|src/download.ts|const response = await fetch(input.url); const script = await response.text(); await writeFile(\"/tmp/remote-installer.sh\", script, \"utf8\"); return execa(input.command); }",
        ruleId: "mcp/download-write-exec",
        file: "src/download.ts",
        line: 5
      },
      {
        fingerprint: "mcp/dynamic-code-exec|src/dynamic.ts|return vm.runInNewContext(input.code, {}); }",
        ruleId: "mcp/dynamic-code-exec",
        file: "src/dynamic.ts",
        line: 4
      },
      {
        fingerprint: "mcp/env-secret-exposure|src/env.ts|const token = process.env.GITHUB_TOKEN; return fetch(input.url, { method: \"POST\",",
        ruleId: "mcp/env-secret-exposure",
        file: "src/env.ts",
        line: 2
      },
      {
        fingerprint: "mcp/script-runner-exec|src/runner.ts|return `npm run ${input.script}`;",
        ruleId: "mcp/script-runner-exec",
        file: "src/runner.ts",
        line: 2
      },
      {
        fingerprint: "mcp/shell-exec|src/download.ts|return execa(input.command);",
        ruleId: "mcp/shell-exec",
        file: "src/download.ts",
        line: 8
      },
      {
        fingerprint: "mcp/shell-exec|src/exfil.ts|const result = await execa(input.command);",
        ruleId: "mcp/shell-exec",
        file: "src/exfil.ts",
        line: 4
      },
      {
        fingerprint: "mcp/shell-exec|src/shell.ts|exec(args.command);",
        ruleId: "mcp/shell-exec",
        file: "src/shell.ts",
        line: 4
      },
      {
        fingerprint: "mcp/subprocess-network-exfil|src/download.ts|const response = await fetch(input.url); const script = await response.text(); await writeFile(\"/tmp/remote-installer.sh\", script, \"utf8\"); return execa(input.command); }",
        ruleId: "mcp/subprocess-network-exfil",
        file: "src/download.ts",
        line: 5
      },
      {
        fingerprint: "mcp/subprocess-network-exfil|src/exfil.ts|const result = await execa(input.command); return fetch(input.url, { method: \"POST\", body: result.stdout }); }",
        ruleId: "mcp/subprocess-network-exfil",
        file: "src/exfil.ts",
        line: 4
      },
      {
        fingerprint: "mcp/sensitive-local-data|src/secrets.ts|return fs.readFile(`${process.env.HOME}/.aws/credentials`, \"utf8\"); }",
        ruleId: "mcp/sensitive-local-data",
        file: "src/secrets.ts",
        line: 4
      },
      {
        fingerprint: "mcp/archive-extract|src/archive.ts|const archive = new AdmZip(input.archivePath); archive.extractAllTo(input.targetPath, true); }",
        ruleId: "mcp/archive-extract",
        file: "src/archive.ts",
        line: 4
      },
      {
        fingerprint: "mcp/archive-extract|src/archive.ts|archive.extractAllTo(input.targetPath, true); }",
        ruleId: "mcp/archive-extract",
        file: "src/archive.ts",
        line: 5
      },
      {
        fingerprint: "mcp/local-service-binding|src/listener.ts|return app.listen(input.port, \"0.0.0.0\"); }",
        ruleId: "mcp/local-service-binding",
        file: "src/listener.ts",
        line: 2
      },
      {
        fingerprint: "mcp/outbound-fetch|src/download.ts|const response = await fetch(input.url);",
        ruleId: "mcp/outbound-fetch",
        file: "src/download.ts",
        line: 5
      },
      {
        fingerprint: "mcp/outbound-fetch|src/env.ts|return fetch(input.url, {",
        ruleId: "mcp/outbound-fetch",
        file: "src/env.ts",
        line: 3
      },
      {
        fingerprint: "mcp/outbound-fetch|src/exfil.ts|return fetch(input.url, {",
        ruleId: "mcp/outbound-fetch",
        file: "src/exfil.ts",
        line: 5
      },
      {
        fingerprint: "mcp/outbound-fetch|src/network.ts|return fetch(input.url);",
        ruleId: "mcp/outbound-fetch",
        file: "src/network.ts",
        line: 2
      },
      {
        fingerprint: "mcp/tool-metadata-risk|src/metadata.ts|description: \"Execute shell commands, read credentials, and send results to a remote endpoint.\" }",
        ruleId: "mcp/tool-metadata-risk",
        file: "src/metadata.ts",
        line: 4
      }
    ], null, 2)}\n`);
  });

  it("trims ignore rule and path entries loaded from config", async () => {
    const configFile = await createConfigFile(
      JSON.stringify({
        "ignore-rules": ["  mcp/shell-exec  "],
        "ignore-paths": ["  src/vendor  "]
      })
    );

    const config = await loadCliConfig(configFile);
    expect(config.ignoreRules).toEqual(["mcp/shell-exec"]);
    expect(config.ignorePaths).toEqual(["src/vendor"]);
  });

  it("fails clearly on invalid config values", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "html" }));
    const stderr: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => createReport("local-directory", ["high"]),
      stdout: createWriter([]),
      stderr: createWriter(stderr)
    });

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain("has invalid 'format'. Expected one of: text, json, markdown, sarif.");
  });

  it("rejects invalid ignore configuration", async () => {
    const configFile = await createConfigFile(JSON.stringify({ "ignore-rules": "mcp/shell-exec" }));
    const stderr: string[] = [];

    const exitCode = await runCli(
      [
        "./fixtures/local-risky",
        "--config",
        configFile
      ],
      {
        auditTarget: async () => createReport("local-directory", ["high"]),
        stdout: createWriter([]),
        stderr: createWriter(stderr)
      }
    );

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain(
      "has invalid 'ignore-rules'. Expected an array of non-empty strings."
    );
  });

  it("rejects blank ignore entries after trimming", async () => {
    const configFile = await createConfigFile(
      JSON.stringify({
        "ignore-rules": ["   "]
      })
    );
    const stderr: string[] = [];

    const exitCode = await runCli(
      [
        "./fixtures/local-risky",
        "--config",
        configFile
      ],
      {
        auditTarget: async () => createReport("local-directory", ["high"]),
        stdout: createWriter([]),
        stderr: createWriter(stderr)
      }
    );

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toContain(
      "has invalid 'ignore-rules'. Expected an array of non-empty strings."
    );
  });

  it("preserves ignore configuration when resolving CLI options", () => {
    const parsed = { target: "./fixtures/local-risky" };
    const config = {
      ignoreRules: ["mcp/shell-exec"],
      ignorePaths: ["src/vendor"]
    };

    const options = resolveCliOptions(parsed, config);
    expect(options.ignoreRules).toEqual(config.ignoreRules);
    expect(options.ignorePaths).toEqual(config.ignorePaths);
  });

  it("passes ignore configuration into auditTarget", async () => {
    const configFile = await createConfigFile(
      JSON.stringify({
        "ignore-rules": ["mcp/shell-exec"],
        "ignore-paths": ["src/generated"]
      })
    );
    const seen: Array<{ ignoreRules?: string[]; ignorePaths?: string[] }> = [];

    const exitCode = await runCli(
      [
        "./fixtures/local-risky",
        "--config",
        configFile
      ],
      {
        auditTarget: async (_target, options) => {
          seen.push(options ?? {});
          return createReport("local-directory", ["high"]);
        },
        stdout: createWriter([])
      }
    );

    expect(exitCode).toBe(0);
    expect(seen).toEqual([
      {
        ignoreRules: ["mcp/shell-exec"],
        ignorePaths: ["src/generated"]
      }
    ]);
  });

  it("lets CLI flags override config values predictably", async () => {
    const configOutputFile = await createTempFilePath("report-from-config.json");
    const cliOutputFile = await createTempFilePath("report-from-cli.md");
    const configFile = await createConfigFile(
      JSON.stringify({
        format: "json",
        "fail-on": "low",
        "summary-only": true,
        "output-file": configOutputFile
      })
    );
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--format",
      "markdown",
      "--fail-on",
      "high",
      "--output-file",
      cliOutputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["medium"]),
      stdout: createWriter(stdout)
    });

    const cliFileContent = await readFile(cliOutputFile, "utf8");
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("# TrustMCP Summary");
    expect(cliFileContent).toContain("# TrustMCP Summary");
    expect(cliFileContent).not.toContain('"tool"');
    await expect(readFile(configOutputFile, "utf8")).rejects.toThrow();
  });

  it("lets CLI flags override an otherwise invalid config combination", async () => {
    const cliOutputFile = await createTempFilePath("report-from-cli.md");
    const configFile = await createConfigFile(
      JSON.stringify({
        format: "sarif",
        "summary-only": true
      })
    );
    const stdout: string[] = [];

    const exitCode = await runCli([
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--format",
      "markdown",
      "--output-file",
      cliOutputFile
    ], {
      auditTarget: async () => createReport("local-directory", ["medium"]),
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("# TrustMCP Summary");
    expect(await readFile(cliOutputFile, "utf8")).toContain("# TrustMCP Summary");
  });

  it("writes a starter config file with the supported stable fields", async () => {
    const outputFile = await createTempFilePath("trustmcp.config.json");
    const stdout: string[] = [];

    const exitCode = await runCli(["init-config", outputFile], {
      stdout: createWriter(stdout)
    });

    const fileContent = await readFile(outputFile, "utf8");
    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(`Wrote starter config to ${outputFile}\n`);
    expect(fileContent).toBe(`{
  "format": "markdown",
  "fail-on": "high",
  "summary-only": false,
  "output-file": "trustmcp-report.md",
  "ignore-rules": [],
  "ignore-paths": [],
  "baseline-file": "trustmcp.baseline.json"
}
`);
  });

  it("refuses to overwrite an existing config file", async () => {
    const outputFile = await createTempFilePath("trustmcp.config.json");
    const stderr: string[] = [];
    await writeFile(outputFile, "{}\n", "utf8");

    const exitCode = await runCli(["init-config", outputFile], {
      stdout: createWriter([]),
      stderr: createWriter(stderr)
    });

    expect(exitCode).toBe(1);
    expect(stderr.join("")).toBe(`TrustMCP error: Config file already exists: ${outputFile}\n`);
    expect(await readFile(outputFile, "utf8")).toBe("{}\n");
  });

  it("prints the shipped rule set in a compact stable form", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["list-rules"], {
      auditTarget: async () => {
        throw new Error("list-rules should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(
      "ruleId\tseverity\ttitle\n" +
      "mcp/archive-extract\tmedium\tArchive extraction capability detected\n" +
      "mcp/broad-filesystem\thigh\tFilesystem access using broad or tool-controlled paths detected\n" +
      "mcp/download-write-exec\thigh\tDownload-to-disk execution chain detected\n" +
      "mcp/dynamic-code-exec\thigh\tDynamic code execution capability detected\n" +
      "mcp/env-secret-exposure\thigh\tEnvironment secret exposure path detected\n" +
      "mcp/local-service-binding\tmedium\tLocal service or port-binding capability detected\n" +
      "mcp/outbound-fetch\tmedium\tOutbound network request capability detected\n" +
      "mcp/script-runner-exec\thigh\tScript runner or package-manager execution wrapper detected\n" +
      "mcp/sensitive-local-data\thigh\tSensitive local credential or secret path access detected\n" +
      "mcp/shell-exec\thigh\tShell execution capability detected\n" +
      "mcp/subprocess-network-exfil\thigh\tSubprocess plus network exfiltration path detected\n" +
      "mcp/tool-metadata-risk\tmedium\tRisky MCP tool capability advertised in metadata\n"
    );
  });

  it("prints the shipped rule set as stable JSON when requested", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["list-rules", "--json"], {
      auditTarget: async () => {
        throw new Error("list-rules should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(`[
  {
    "id": "mcp/archive-extract",
    "severity": "medium",
    "title": "Archive extraction capability detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "fixed-archive-extraction",
      "tool-controlled-archive-path"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "fixed-archive-extraction",
        "description": "An archive extraction helper was matched without clear tool-controlled archive or target input."
      },
      {
        "level": "high",
        "reason": "tool-controlled-archive-path",
        "description": "The archive source or extraction target appears to come from tool or request input."
      }
    ]
  },
  {
    "id": "mcp/broad-filesystem",
    "severity": "high",
    "title": "Filesystem access using broad or tool-controlled paths detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "recursive-filesystem-operation",
      "root-or-home-directory-path",
      "broad-operation-with-tool-controlled-path",
      "tool-controlled-path",
      "broad-operation-with-non-literal-path"
    ],
    "confidenceGuidance": [
      {
        "level": "high",
        "reason": "recursive-filesystem-operation",
        "description": "A recursive filesystem operation such as rm/cp/readdir with recursive=true was matched."
      },
      {
        "level": "high",
        "reason": "root-or-home-directory-path",
        "description": "The filesystem path reaches HOME, USERPROFILE, os.homedir(), or a tilde-rooted path."
      },
      {
        "level": "high",
        "reason": "broad-operation-with-tool-controlled-path",
        "description": "A broad filesystem operation appears to take a tool-controlled path argument."
      },
      {
        "level": "medium",
        "reason": "tool-controlled-path",
        "description": "A filesystem call appears to take a tool-controlled path argument."
      },
      {
        "level": "medium",
        "reason": "broad-operation-with-non-literal-path",
        "description": "A broad filesystem operation uses a non-literal path even without explicit tool-input evidence."
      }
    ]
  },
  {
    "id": "mcp/download-write-exec",
    "severity": "high",
    "title": "Download-to-disk execution chain detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "fixed-download-write-exec-chain",
      "tool-controlled-download-or-exec-input"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "fixed-download-write-exec-chain",
        "description": "A download-write-execute chain was matched without clear tool-controlled download or execution input."
      },
      {
        "level": "high",
        "reason": "tool-controlled-download-or-exec-input",
        "description": "The download source, written artifact, or execution step appears to depend on tool input."
      }
    ]
  },
  {
    "id": "mcp/dynamic-code-exec",
    "severity": "high",
    "title": "Dynamic code execution capability detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "literal-dynamic-eval",
      "vm-execution-api",
      "tool-controlled-code-input"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "literal-dynamic-eval",
        "description": "A direct eval or Function-style primitive was matched without clear tool-controlled code input."
      },
      {
        "level": "high",
        "reason": "vm-execution-api",
        "description": "A vm execution API was matched, which is treated as a stronger dynamic execution surface."
      },
      {
        "level": "high",
        "reason": "tool-controlled-code-input",
        "description": "The executed code string appears to come from tool or request input."
      }
    ]
  },
  {
    "id": "mcp/env-secret-exposure",
    "severity": "high",
    "title": "Environment secret exposure path detected",
    "confidenceLevels": [
      "high"
    ],
    "confidenceReasons": [
      "secret-env-var-reaches-dangerous-sink"
    ],
    "confidenceGuidance": [
      {
        "level": "high",
        "reason": "secret-env-var-reaches-dangerous-sink",
        "description": "A secret-bearing environment variable appears to flow into a network, execution, logging, or return sink."
      }
    ]
  },
  {
    "id": "mcp/local-service-binding",
    "severity": "medium",
    "title": "Local service or port-binding capability detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "local-listener-startup",
      "explicit-public-bind-address",
      "tool-controlled-bind-parameter"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "local-listener-startup",
        "description": "A local listener startup path was matched without explicit public bind or tool-controlled bind input."
      },
      {
        "level": "high",
        "reason": "explicit-public-bind-address",
        "description": "The listener binds an explicitly public address such as 0.0.0.0 or ::."
      },
      {
        "level": "high",
        "reason": "tool-controlled-bind-parameter",
        "description": "The host, port, or bind target appears to come from tool or request input."
      }
    ]
  },
  {
    "id": "mcp/outbound-fetch",
    "severity": "medium",
    "title": "Outbound network request capability detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "literal-fetch-call",
      "non-fetch-network-client",
      "tool-controlled-url"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "literal-fetch-call",
        "description": "A plain fetch call was matched without clear tool-controlled destination evidence."
      },
      {
        "level": "high",
        "reason": "non-fetch-network-client",
        "description": "A stronger network client surface such as axios, http(s), got, or undici was matched."
      },
      {
        "level": "high",
        "reason": "tool-controlled-url",
        "description": "The destination URL appears to come from tool or request input."
      }
    ]
  },
  {
    "id": "mcp/script-runner-exec",
    "severity": "high",
    "title": "Script runner or package-manager execution wrapper detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "fixed-script-runner-command",
      "tool-controlled-script-runner-input"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "fixed-script-runner-command",
        "description": "A package-manager or script-runner execution wrapper was matched with a fixed command."
      },
      {
        "level": "high",
        "reason": "tool-controlled-script-runner-input",
        "description": "The script, task, or runner input appears to come from tool or request data."
      }
    ]
  },
  {
    "id": "mcp/sensitive-local-data",
    "severity": "high",
    "title": "Sensitive local credential or secret path access detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "fixed-sensitive-local-path",
      "tool-controlled-secret-path"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "fixed-sensitive-local-path",
        "description": "A known secret-bearing local path was matched without clear tool-controlled path input."
      },
      {
        "level": "high",
        "reason": "tool-controlled-secret-path",
        "description": "The secret-bearing path appears to come from tool or request input."
      }
    ]
  },
  {
    "id": "mcp/shell-exec",
    "severity": "high",
    "title": "Shell execution capability detected",
    "confidenceLevels": [
      "high"
    ],
    "confidenceReasons": [
      "direct-command-execution-api"
    ],
    "confidenceGuidance": [
      {
        "level": "high",
        "reason": "direct-command-execution-api",
        "description": "Direct command execution primitives such as child_process, execa, or Bun.spawn were matched."
      }
    ]
  },
  {
    "id": "mcp/subprocess-network-exfil",
    "severity": "high",
    "title": "Subprocess plus network exfiltration path detected",
    "confidenceLevels": [
      "medium",
      "high"
    ],
    "confidenceReasons": [
      "subprocess-plus-network-chain",
      "tool-controlled-exfiltration-path"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "subprocess-plus-network-chain",
        "description": "A subprocess plus outbound network chain was matched without clear tool-controlled exfiltration input."
      },
      {
        "level": "high",
        "reason": "tool-controlled-exfiltration-path",
        "description": "The command, URL, output path, or payload appears to be controlled by tool input."
      }
    ]
  },
  {
    "id": "mcp/tool-metadata-risk",
    "severity": "medium",
    "title": "Risky MCP tool capability advertised in metadata",
    "confidenceLevels": [
      "medium"
    ],
    "confidenceReasons": [
      "metadata-advertises-risky-capability"
    ],
    "confidenceGuidance": [
      {
        "level": "medium",
        "reason": "metadata-advertises-risky-capability",
        "description": "Tool metadata text directly advertises risky host capabilities such as shell, secrets, or remote exfiltration."
      }
    ]
  }
]
`);
  });

  it("prints the TrustMCP version without invoking the scan engine", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["--version"], {
      auditTarget: async () => {
        throw new Error("version should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toBe(`${TRUSTMCP_VERSION}\n`);
  });

  it("prints the same version for -v and version", async () => {
    const shortStdout: string[] = [];
    const commandStdout: string[] = [];

    const shortExitCode = await runCli(["-v"], {
      auditTarget: async () => {
        throw new Error("version should not invoke the scan engine");
      },
      stdout: createWriter(shortStdout)
    });

    const commandExitCode = await runCli(["version"], {
      auditTarget: async () => {
        throw new Error("version should not invoke the scan engine");
      },
      stdout: createWriter(commandStdout)
    });

    expect(shortExitCode).toBe(0);
    expect(commandExitCode).toBe(0);
    expect(shortStdout.join("")).toBe(`${TRUSTMCP_VERSION}\n`);
    expect(commandStdout.join("")).toBe(`${TRUSTMCP_VERSION}\n`);
  });

  it("prints task-grouped help output when no command is provided", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([], {
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    const help = stdout.join("");
    expect(help).toContain("Run a scan:");
    expect(help).toContain("Validate first:");
    expect(help).toContain("Set up locally:");
    expect(help).toContain("Inspect rules:");
    expect(help).toContain("Inspect version:");
    expect(help).toContain("Targets:");
  });

  it("runs doctor successfully for a valid local target and config without invoking the scan engine", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "json" }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain(`TrustMCP doctor v${TRUSTMCP_VERSION}`);
    expect(stdout.join("")).toContain(`Config: OK ${configFile}`);
    expect(stdout.join("")).toContain("Target: OK local directory");
    expect(stdout.join("")).toContain("Status: ready to scan.");
  });

  it("renders doctor as stable JSON when requested", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "json" }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--json"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout.join("")) as {
      ok: boolean;
      version: string;
      config: { ok: boolean; message: string };
      runtime: { ok: boolean; message: string };
      target: { ok: boolean; message: string; kind?: string; displayName?: string };
      status: string;
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.version).toBe(TRUSTMCP_VERSION);
    expect(parsed.config).toEqual({
      ok: true,
      message: configFile
    });
    expect(parsed.runtime.ok).toBe(true);
    expect(parsed.runtime.message).toContain(`Node.js ${process.versions.node}`);
    expect(parsed.target).toMatchObject({
      ok: true,
      kind: "local-directory"
    });
    expect(parsed.target.displayName).toContain("fixtures/local-risky");
    expect(parsed.target.message).toContain("local directory (");
    expect(parsed.target.message).toContain("fixtures/local-risky");
    expect(parsed.status).toBe("ready to scan.");
  });

  it("includes structured GitHub target metadata in doctor JSON output", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "gh:modelcontextprotocol/servers",
      "--json"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    const parsed = JSON.parse(stdout.join("")) as {
      ok: boolean;
      target: {
        ok: boolean;
        kind?: string;
        displayName?: string;
        message: string;
      };
    };

    expect(exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.target).toMatchObject({
      ok: true,
      kind: "public-github-repo",
      displayName: "modelcontextprotocol/servers"
    });
    expect(parsed.target.message).toBe("GitHub repository input (modelcontextprotocol/servers)");
  });

  it("includes explicit requested GitHub refs in doctor JSON output", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "gh:modelcontextprotocol/servers@release-branch",
      "--json"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    const parsed = JSON.parse(stdout.join("")) as {
      ok: boolean;
      target: {
        ok: boolean;
        displayName?: string;
        resolvedRef?: string;
        message: string;
      };
    };

    expect(exitCode).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.target.displayName).toBe("modelcontextprotocol/servers");
    expect(parsed.target.resolvedRef).toBe("release-branch");
    expect(parsed.target.message).toBe("GitHub repository input (modelcontextprotocol/servers @ release-branch)");
  });

  it("reports configured output-file paths as valid in doctor when the parent directory exists", async () => {
    const outputFile = await createTempFilePath("trustmcp.json");
    const configFile = await createConfigFile(JSON.stringify({ "output-file": outputFile }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--json"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain(`"message": "${configFile} (output-file OK: ${outputFile})"`);
  });

  it("reports configured baseline paths as valid in doctor when the file exists and is readable", async () => {
    const baselineFile = await createTempFilePath("trustmcp.baseline.json");
    const configFile = await createConfigFile(JSON.stringify({ "baseline-file": baselineFile }));
    const stdout: string[] = [];
    await writeFile(
      baselineFile,
      JSON.stringify([{ fingerprint: "mcp/shell-exec|src/shell.ts|exec(args.command);", ruleId: "mcp/shell-exec", file: "src/shell.ts", line: 4 }]),
      "utf8"
    );

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--json"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain(`"message": "${configFile} (baseline-file OK: ${baselineFile})"`);
  });

  it("writes doctor text output to a file when requested", async () => {
    const outputFile = await createTempFilePath("doctor.txt");
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--output-file",
      outputFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain(`TrustMCP doctor v${TRUSTMCP_VERSION}`);
    expect(await readFile(outputFile, "utf8")).toContain(`TrustMCP doctor v${TRUSTMCP_VERSION}`);
  });

  it("writes doctor JSON output to a file when requested", async () => {
    const outputFile = await createTempFilePath("doctor.json");
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--json",
      "--output-file",
      outputFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain(`"version": "${TRUSTMCP_VERSION}"`);
    expect(await readFile(outputFile, "utf8")).toContain(`"version": "${TRUSTMCP_VERSION}"`);
  });

  it("writes list-rules TSV output to a file when requested", async () => {
    const outputFile = await createTempFilePath("rules.tsv");
    const stdout: string[] = [];

    const exitCode = await runCli(["list-rules", "--output-file", outputFile], {
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain("mcp/shell-exec");
    expect(await readFile(outputFile, "utf8")).toContain("mcp/shell-exec");
  });

  it("writes list-rules JSON output to a file when requested", async () => {
    const outputFile = await createTempFilePath("rules.json");
    const stdout: string[] = [];

    const exitCode = await runCli(["list-rules", "--json", "--output-file", outputFile], {
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("")).toContain(`"id": "mcp/shell-exec"`);
    expect(await readFile(outputFile, "utf8")).toContain(`"id": "mcp/shell-exec"`);
  });

  it("reports configured output-file paths with missing parent directories in doctor", async () => {
    const directory = await mkdtemp(join(tmpdir(), "trustmcp-cli-test-"));
    tempDirectories.push(directory);
    const missingOutputFile = join(directory, "missing", "trustmcp.json");
    const configFile = await createConfigFile(JSON.stringify({ "output-file": missingOutputFile }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Config: ERROR Output file directory does not exist:");
    expect(stdout.join("")).toContain(join(directory, "missing"));
  });

  it("reports invalid baseline files in doctor before a scan runs", async () => {
    const baselineFile = await createTempFilePath("trustmcp.baseline.json");
    const configFile = await createConfigFile(JSON.stringify({ "baseline-file": baselineFile }));
    const stdout: string[] = [];
    await writeFile(baselineFile, JSON.stringify([{ ruleId: "", file: "src/example.ts" }]), "utf8");

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Config: ERROR Baseline file");
    expect(stdout.join("")).toContain("has invalid 'ruleId'");
  });

  it("reports unsupported GitHub tree URLs compactly in doctor", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "https://github.com/modelcontextprotocol/servers/tree/main"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Target: ERROR GitHub tree URLs are not supported.");
    expect(stdout.join("")).toContain("Use the repository root URL instead: https://github.com/modelcontextprotocol/servers");
    expect(stdout.join("")).toContain("Status: fix the errors above and run doctor again.");
  });

  it("reports invalid gh shorthand compactly in doctor", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["doctor", "gh:modelcontextprotocol"], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Target: ERROR GitHub shorthand inputs must look like gh:<owner>/<repo>.");
  });

  it("reports missing local directories compactly in doctor", async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(["doctor", "./fixtures/does-not-exist"], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Target: ERROR Local directory not found: ./fixtures/does-not-exist");
  });

  it("reports invalid config files in doctor", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "html" }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain("Config: ERROR Config file");
    expect(stdout.join("")).toContain("has invalid 'format'. Expected one of: text, json, markdown, sarif.");
  });

  it("reports invalid config combinations in doctor before a scan runs", async () => {
    const configFile = await createConfigFile(JSON.stringify({ format: "sarif", "summary-only": true }));
    const stdout: string[] = [];

    const exitCode = await runCli([
      "doctor",
      "./fixtures/local-risky",
      "--config",
      configFile,
      "--json"
    ], {
      auditTarget: async () => {
        throw new Error("doctor should not invoke the scan engine");
      },
      stdout: createWriter(stdout)
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toContain(`"message": "Invalid option combination in config: --summary-only is not supported with --format sarif."`);
  });

  it("accepts supported Node.js runtimes for doctor validation", async () => {
    await expect(validateNodeRuntimeVersion("18.18.0")).resolves.toEqual({
      ok: true,
      message: "Node.js 18.18.0 satisfies supported runtime >=18.18."
    });
  });

  it("accepts supported Node.js runtimes with v prefix and prerelease suffix", async () => {
    await expect(validateNodeRuntimeVersion("v18.18.0-rc.1")).resolves.toEqual({
      ok: true,
      message: "Node.js v18.18.0-rc.1 satisfies supported runtime >=18.18."
    });
  });

  it("rejects unsupported Node.js runtimes for doctor validation", async () => {
    await expect(validateNodeRuntimeVersion("18.17.9")).resolves.toEqual({
      ok: false,
      message: "Node.js 18.17.9 does not satisfy supported runtime >=18.18."
    });
  });

  it("rejects invalid Node.js runtime version formats for doctor validation", async () => {
    await expect(validateNodeRuntimeVersion("18.18")).rejects.toThrow("Unsupported Node.js version format: 18.18");
  });
});

function createReport(sourceType: "local-directory" | "public-github-repo", severities: Severity[]): AuditReport {
  const findings = severities.map((severity, index) => ({
    fingerprint: `rule-${index + 1}|src/example-${index + 1}.ts|evidence-${index + 1}`,
    ruleId: `rule-${index + 1}`,
    severity,
    confidence: "high" as const,
    confidenceReason: `rule-specific-test-reason-${index + 1}`,
    title: severity === "high"
      ? "Shell execution capability detected"
      : severity === "medium"
        ? "Outbound network request capability detected"
        : "Low severity placeholder finding",
    file: `src/example-${index + 1}.ts`,
    line: index + 1,
    evidence: `evidence-${index + 1}`,
    whyItMatters: `why-${index + 1}`,
    remediation: `remediation-${index + 1}`
  }));

  return {
    tool: {
      name: "TrustMCP",
      version: TRUSTMCP_VERSION
    },
    target: {
      input: sourceType === "local-directory" ? "./fixtures/local-risky" : "https://github.com/example/risky-mcp",
      displayName: sourceType === "local-directory" ? "./fixtures/local-risky" : "example/risky-mcp",
      sourceType
    },
    limitations: [
      "Static heuristics only.",
      "TrustMCP does not execute the target.",
      "No finding set should be interpreted as a safety guarantee."
    ],
    summary: {
      baselineApplied: false,
      findingCount: severities.length,
      newFindingCount: severities.length,
      gatedFindingCount: severities.length,
      triggeredRuleCount: severities.length,
      newTriggeredRuleCount: severities.length,
      gatedTriggeredRuleCount: severities.length,
      severityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      newSeverityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      gatedSeverityCounts: {
        low: severities.filter((severity) => severity === "low").length,
        medium: severities.filter((severity) => severity === "medium").length,
        high: severities.filter((severity) => severity === "high").length
      },
      message: severities.length === 0
        ? "No matching rules were triggered. Static heuristics only; this does not mean the target is safe."
        : `${severities.length} finding(s) across ${severities.length} rule(s). Static heuristics only.`
    },
    findings,
    newFindings: findings
  };
}

function createWriter(chunks: string[]) {
  return {
    write(chunk: string) {
      chunks.push(chunk);
    }
  };
}

async function createTempFilePath(fileName: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "trustmcp-cli-test-"));
  tempDirectories.push(directory);
  return join(directory, fileName);
}

async function createConfigFile(content: string): Promise<string> {
  const configPath = await createTempFilePath("trustmcp.config.json");
  await writeFile(configPath, content, "utf8");
  return configPath;
}
