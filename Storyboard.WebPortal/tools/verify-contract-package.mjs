import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve("@jojo-d-little/storyboard-contracts/package.json"));
const schemaDirectory = join(packageDirectory, "HostContracts", "Schemas");
async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const schemaFiles = await listFiles(schemaDirectory);
const requiredFiles = [
  join(packageDirectory, "HostContracts/Transport/host-transport-manifest.json"),
  ...schemaFiles
];

for (const relativePath of requiredFiles) {
  await access(relativePath);
}

const manifest = JSON.parse(await readFile(requiredFiles[0], "utf8"));
if (!manifest || typeof manifest !== "object") {
  throw new Error("The host transport manifest is not a JSON object.");
}

function readSchema(fileName) {
  const path = schemaFiles.find((candidate) => candidate.endsWith(fileName));
  if (!path) throw new Error(`Missing required Host contract schema: ${fileName}`);
  return readFile(path, "utf8").then(JSON.parse);
}

const [moveLegSchema, segmentSchema, imageSchema] = await Promise.all([
  readSchema("HostCommandMoveLegTelemetry_contract.schema.json"),
  readSchema("HostMovementSegment_contract.schema.json"),
  readSchema("HostCommandRenderableImage_contract.schema.json")
]);
if (!moveLegSchema.properties?.movementSegments || !segmentSchema.properties?.objectId
  || !segmentSchema.properties?.coordinationId || !segmentSchema.properties?.startOffsetMs
  || !segmentSchema.properties?.fromRenderableImage || !segmentSchema.properties?.toRenderableImage
  || !imageSchema.properties?.elevationPx) {
  throw new Error("The delivered Host schemas do not contain the accepted coordinated movement segment and elevation fields.");
}

console.log(`Verified ${schemaFiles.length} Host schema files, coordinated movement segments and elevation metadata from @jojo-d-little/storyboard-contracts.`);
