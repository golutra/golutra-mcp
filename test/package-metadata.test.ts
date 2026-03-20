import { describe, expect, it } from "vitest";

import { readPackageMetadata } from "../src/lib/package-metadata.js";

describe("readPackageMetadata", () => {
  it("reads the package name and version from package.json", () => {
    expect(readPackageMetadata()).toMatchObject({
      name: "golutra-mcp"
    });
    expect(readPackageMetadata().version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
