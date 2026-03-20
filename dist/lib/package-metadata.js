import { readFileSync } from "node:fs";
let cachedPackageMetadata;
export function readPackageMetadata() {
    if (cachedPackageMetadata) {
        return cachedPackageMetadata;
    }
    const packageJsonPath = new URL("../../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof packageJson.name !== "string" ||
        !packageJson.name.trim() ||
        typeof packageJson.version !== "string" ||
        !packageJson.version.trim()) {
        throw new Error("package.json is missing a valid name or version");
    }
    cachedPackageMetadata = {
        name: packageJson.name,
        version: packageJson.version
    };
    return cachedPackageMetadata;
}
//# sourceMappingURL=package-metadata.js.map