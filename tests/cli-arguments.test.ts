import { describe, expect, it } from "vitest";

import { parseArguments } from "../src/cli/arguments.js";

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
