import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it.each(["/dashboard", "/projects/123?tab=files", "/messages#latest"])("accepts local path %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["absolute URL", "https://evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["embedded newline", "/ok\nLocation: //evil"],
    ["embedded backslash", "/ok\\..\\evil"],
    ["empty", ""],
    ["non-string", 42],
    ["too long", `/${"a".repeat(600)}`],
  ])("rejects %s", (_label, value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });

  it("uses the provided fallback", () => {
    expect(safeNext(null, "/login")).toBe("/login");
  });
});
