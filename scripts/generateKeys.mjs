import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });

// exportPKCS8 already returns a properly formatted multi-line PEM string.
// Do NOT replace newlines — a valid PEM requires them.
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd();

const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

const keyPath = join(tmpdir(), "jwt_private_key");
const jwksPath = join(tmpdir(), "jwks");

writeFileSync(keyPath, privateKey);
writeFileSync(jwksPath, jwks);

console.log("\n=======================================================");
console.log("   GENERATED MATCHED CONVEX AUTH JWT KEYPAIR (RS256)");
console.log("=======================================================\n");
console.log("JWT_PRIVATE_KEY (set this in Convex Environment Variables):");
console.log(privateKey);
console.log("\nJWKS (set this in Convex Environment Variables):");
console.log(jwks);
console.log("\n=======================================================\n");
