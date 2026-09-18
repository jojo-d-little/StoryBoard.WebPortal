import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve("@jojo-d-little/storyboard-contracts/package.json"));
const schemaDirectory = join(packageDirectory, "HostContracts", "Schemas");
const schemaFiles = await readdir(schemaDirectory);
const requiredFiles = [
  "HostContracts/Transport/host-transport-manifest.json",
  ...schemaFiles.map((fileName) => join("HostContracts/Schemas", fileName))
];

for (const relativePath of requiredFiles) {
  await access(join(packageDirectory, relativePath));
}

const manifest = JSON.parse(await readFile(join(packageDirectory, requiredFiles[0]), "utf8"));
if (!manifest || typeof manifest !== "object") {
  throw new Error("The host transport manifest is not a JSON object.");
}

console.log(`Verified ${requiredFiles.length} host contract files from @jojo-d-little/storyboard-contracts.`);