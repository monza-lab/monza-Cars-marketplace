import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { isDirectRun, resolveBackupPath } from "./clean-scraped-descriptions";

describe("clean-scraped-descriptions entry point", () => {
  it("recognizes a native argv path, including spaces, as the current file URL", () => {
    const entry = resolve("repo with spaces", "scripts", "clean-scraped-descriptions.ts");
    expect(isDirectRun(pathToFileURL(entry).href, entry)).toBe(true);
  });

  it.runIf(process.platform === "win32")("recognizes a Windows argv path as the current file URL", () => {
    expect(
      isDirectRun(
        "file:///C:/repo/scripts/clean-scraped-descriptions.ts",
        "C:\\repo\\scripts\\clean-scraped-descriptions.ts",
      ),
    ).toBe(true);
  });

  it("does not execute when the script is imported from another entry point", () => {
    expect(
      isDirectRun(
        "file:///C:/repo/scripts/clean-scraped-descriptions.ts",
        "C:\\repo\\scripts\\other.ts",
      ),
    ).toBe(false);
  });
});

describe("clean-scraped-descriptions recovery", () => {
  it("requires an explicit backup before applying destructive cleanup", () => {
    expect(() => resolveBackupPath(["--apply"])).toThrow(/--backup/);
    expect(resolveBackupPath(["--apply", "--backup=C:\\safe\\classic.jsonl"]))
      .toBe("C:\\safe\\classic.jsonl");
    expect(resolveBackupPath([])).toBeNull();
  });
});
