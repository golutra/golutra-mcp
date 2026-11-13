import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const REGISTRY = "https://registry.npmjs.org";
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function validateRelease(pkg, lock, { dryRun, refType, refName }) {
  if (pkg.name !== "golutra-mcp" || pkg.private || !STABLE_VERSION.test(pkg.version)) {
    throw new Error("Release requires the public golutra-mcp package and a stable x.y.z version.");
  }
  for (const entry of [lock, lock.packages?.[""]]) {
    if (entry?.name !== pkg.name || entry?.version !== pkg.version) {
      throw new Error("package.json and package-lock.json must have the same name and version.");
    }
  }
  if (!dryRun && refType !== "tag") {
    throw new Error("Publishing requires a version tag; branch runs must be dry runs.");
  }
  if (refType === "tag" && refName !== `v${pkg.version}`) {
    throw new Error("Release tag must match the package version exactly.");
  }
  return { name: pkg.name, version: pkg.version, filename: `${pkg.name}-${pkg.version}.tgz` };
}

export function releaseNotes(changelog, version) {
  const heading = `## [${version}] - `;
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex(line => line.startsWith(heading));
  if (start < 0) throw new Error(`Missing CHANGELOG entry for ${version}.`);
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const body = lines.slice(start + 1, next < 0 ? undefined : next).join("\n").trim();
  if (!body) throw new Error(`Empty CHANGELOG entry for ${version}.`);
  return `${lines[start]}\n\n${body}\n`;
}

export async function fetchPublishedPackage(pkg, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${REGISTRY}/${pkg.name}/${pkg.version}`, {
    headers: { "cache-control": "no-cache" },
    signal: globalThis.AbortSignal.timeout(15_000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Registry lookup failed: HTTP ${response.status}.`);
  const published = await response.json();
  if (published.name !== pkg.name || published.version !== pkg.version ||
      typeof published.dist?.integrity !== "string") {
    throw new Error("Registry returned invalid package metadata.");
  }
  return published;
}

export function releaseAction(artifact, published, dryRun) {
  if (dryRun) return "dry-run";
  if (!published) return "publish";
  if (published.dist.integrity !== artifact.integrity) {
    throw new Error("This version is already published with different content. Do not overwrite or move its tag.");
  }
  return "existing";
}

async function emitOutputs(values) {
  process.stdout.write(`${JSON.stringify(values, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values)
      .map(([name, value]) => `${name}=${value}\n`).join(""));
  }
}

async function readArtifact(directory, pkg) {
  const packed = JSON.parse(await readFile(join(directory, "pack.json"), "utf8"));
  const artifact = packed[0];
  if (packed.length !== 1 || artifact?.name !== pkg.name ||
      artifact.version !== pkg.version || artifact.filename !== pkg.filename) {
    throw new Error("npm pack must contain exactly the expected package and version.");
  }
  const bytes = await readFile(join(directory, pkg.filename));
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (artifact.integrity !== integrity) throw new Error("Package archive integrity mismatch.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(join(directory, "SHA256SUMS"), `${sha256}  ${pkg.filename}\n`);
  return artifact;
}

export async function verifyPublication(artifact, lookup, wait = delay, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const published = await lookup();
    if (published) {
      releaseAction(artifact, published, false);
      return;
    }
    if (attempt + 1 < attempts) await wait(10_000);
  }
  throw new Error("npm has not exposed this version yet. Check processing status before rerunning; do not republish blindly.");
}

async function main() {
  const [command, directory] = process.argv.slice(2);
  if (!["prepare", "check", "verify"].includes(command) || !directory) {
    throw new Error("Usage: node scripts/release.mjs <prepare|check|verify> <artifact-directory>");
  }
  const dryRun = process.env.RELEASE_DRY_RUN;
  if (dryRun !== "true" && dryRun !== "false") throw new Error("Set RELEASE_DRY_RUN to true or false explicitly.");
  const pkg = validateRelease(
    JSON.parse(await readFile("package.json", "utf8")),
    JSON.parse(await readFile("package-lock.json", "utf8")),
    { dryRun: dryRun === "true", refType: process.env.GITHUB_REF_TYPE, refName: process.env.GITHUB_REF_NAME }
  );
  if (command === "prepare") {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "release-notes.md"), releaseNotes(await readFile("CHANGELOG.md", "utf8"), pkg.version));
    await emitOutputs(pkg);
    return;
  }
  const artifact = await readArtifact(directory, pkg);
  const lookup = () => fetchPublishedPackage(pkg);
  if (command === "verify") {
    await verifyPublication(artifact, lookup);
    await emitOutputs({ version: pkg.version, verified: true });
    return;
  }
  const published = await lookup();
  const action = releaseAction(artifact, published, dryRun === "true");
  await emitOutputs({
    action, version: pkg.version, alreadyPublished: published !== null,
    identical: published?.dist.integrity === artifact.integrity
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `Package: ${pkg.name}@${pkg.version}\n\nAction: ${action}\n\n` +
      `Version already public: ${published !== null}. Archive matches: ${published?.dist.integrity === artifact.integrity}.\n\n` +
      (dryRun === "true" ? "Dry run only: no npm upload or GitHub Release. OIDC publishing permission is not tested.\n" : ""));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
