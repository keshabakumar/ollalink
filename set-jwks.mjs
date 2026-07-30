/**
 * Sets the correct JWKS env var on Convex prod by spawning the convex CLI
 * with proper argument escaping (avoids shell quote-stripping issues).
 *
 * Usage:  node set-jwks.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const jwksPath = join(import.meta.dirname, "convex-ready-template-main", "convex-ready-template-main", "tmp", "jwks");
const jwksValue = readFileSync(jwksPath, "utf-8").trim();
console.log("JWKS value to set:\n", jwksValue, "\n");

const backendDir = join(import.meta.dirname, "convex-ready-template-main", "convex-ready-template-main", "packages", "backend");

const result = spawnSync("npx", ["convex", "env", "set", "JWKS", "--prod", "--", jwksValue], {
  cwd: backendDir,
  shell: true,
  encoding: "utf-8",
});

console.log("STDOUT:", result.stdout);
console.log("STDERR:", result.stderr);
console.log("Exit code:", result.status);