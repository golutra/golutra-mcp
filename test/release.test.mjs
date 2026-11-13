import { describe, expect, it, vi } from "vitest";
import {
  fetchPublishedPackage, releaseAction, releaseNotes, validateRelease, verifyPublication
} from "../scripts/release.mjs";

const pkg = { name: "golutra-mcp", version: "0.1.5" };
const lock = { ...pkg, packages: { "": pkg } };
const tag = { dryRun: false, refType: "tag", refName: "v0.1.5" };
const artifact = { ...pkg, integrity: "sha512-validated" };
const published = { ...pkg, dist: { integrity: artifact.integrity } };

describe("release boundaries", () => {
  it("requires an exact stable tag and synchronized metadata for publishing", () => {
    expect(validateRelease(pkg, lock, tag).filename).toBe("golutra-mcp-0.1.5.tgz");
    expect(() => validateRelease(pkg, lock, { ...tag, refType: "branch" })).toThrow("version tag");
    expect(() => validateRelease(pkg, lock, { ...tag, refName: "v0.1.6" })).toThrow("match");
    expect(() => validateRelease(pkg, { ...lock, version: "0.1.4" }, tag)).toThrow("same");
    expect(() => validateRelease(pkg, { ...lock, packages: { "": { ...pkg, version: "0.1.4" } } }, tag)).toThrow("same");
    expect(() => validateRelease({ ...pkg, version: "0.1.6-rc.1" }, lock, tag)).toThrow("stable");
    expect(() => validateRelease({ ...pkg, private: true }, lock, tag)).toThrow("public");
  });

  it("allows branch previews without permitting an upload", () => {
    expect(validateRelease(pkg, lock, { dryRun: true, refType: "branch", refName: "main" }).version).toBe("0.1.5");
    expect(releaseAction(artifact, null, true)).toBe("dry-run");
    expect(releaseAction(artifact, published, true)).toBe("dry-run");
    expect(releaseAction(artifact, { ...published, dist: { integrity: "different" } }, true)).toBe("dry-run");
  });

  it("publishes only new versions and makes identical retries idempotent", () => {
    expect(releaseAction(artifact, null, false)).toBe("publish");
    expect(releaseAction(artifact, published, false)).toBe("existing");
    expect(() => releaseAction(artifact, { ...published, dist: { integrity: "different" } }, false)).toThrow("different content");
  });

  it("extracts only the target version notes and rejects missing or empty entries", () => {
    const notes = "## [Unreleased]\n\nFuture\n\n## [0.1.5] - 2026-11-13\n\nReleased\n\n## [0.1.4] - 2026-05-07\n\nOlder\n";
    expect(releaseNotes(notes, "0.1.5")).toBe("## [0.1.5] - 2026-11-13\n\nReleased\n");
    expect(() => releaseNotes(notes, "0.1.6")).toThrow("Missing");
    expect(() => releaseNotes("## [0.1.5] - 2026-11-13\n\n", "0.1.5")).toThrow("Empty");
    expect(() => releaseNotes("## [0.1.5] - 2026-11-13\n\n## [0.1.4] - 2026-05-07\n\nOlder", "0.1.5")).toThrow("Empty");
  });
});

describe("registry verification", () => {
  it("treats only HTTP 404 as an unpublished version", async () => {
    await expect(fetchPublishedPackage(pkg, vi.fn().mockResolvedValue({ status: 404 }))).resolves.toBeNull();
    for (const status of [401, 403, 429, 500]) {
      await expect(fetchPublishedPackage(pkg, vi.fn().mockResolvedValue({ status, ok: false }))).rejects.toThrow(`HTTP ${status}`);
    }
    await expect(fetchPublishedPackage(pkg, vi.fn().mockRejectedValue(new Error("network")))).rejects.toThrow("network");
  });

  it("validates the name, version and integrity in successful metadata", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => published });
    await expect(fetchPublishedPackage(pkg, fetch)).resolves.toEqual(published);
    for (const invalid of [{}, { ...published, name: "other" }, { ...published, version: "0.1.4" }, { ...pkg, dist: {} }]) {
      await expect(fetchPublishedPackage(pkg, vi.fn().mockResolvedValue({ ok: true, json: () => invalid }))).rejects.toThrow("invalid");
    }
  });

  it("waits for asynchronous visibility without publishing again", async () => {
    const lookup = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(published);
    const wait = vi.fn();
    await verifyPublication(artifact, lookup, wait, 3);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("fails on different public bytes or bounded processing timeout", async () => {
    const wait = vi.fn();
    await expect(verifyPublication(artifact, vi.fn().mockResolvedValue({ ...published, dist: { integrity: "wrong" } }), wait)).rejects.toThrow("different content");
    expect(wait).not.toHaveBeenCalled();
    const missing = vi.fn().mockResolvedValue(null);
    await expect(verifyPublication(artifact, missing, wait, 2)).rejects.toThrow("processing status");
    expect(missing).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});
