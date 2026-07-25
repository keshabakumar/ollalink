import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey))
  .trimEnd()
  .replace(/\\n/g, "\n")
  .replace(/\r/g, "")
  .replace(/\n/g, " ");
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

const keyPath = join(tmpdir(), "jwt_private_key");
const jwksPath = join(tmpdir(), "jwks");

writeFileSync(keyPath, privateKey);
writeFileSync(jwksPath, jwks);

console.log("\n=======================================================");
console.log("   GENERATED MATCHED CONVEX AUTH JWT KEYPAIR (RS256)");
console.log("=======================================================\n");
console.log("1) Set JWT_PRIVATE_KEY in Convex Environment Variables:");
console.log(privateKey);
console.log("\n2) Set JWKS in Convex Environment Variables:");
console.log(jwks);
console.log("\n=======================================================\n");
