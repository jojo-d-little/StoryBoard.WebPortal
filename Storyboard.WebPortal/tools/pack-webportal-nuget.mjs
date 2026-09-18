import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryDirectory = resolve(appDirectory, "..");
const packageProject = join(repositoryDirectory, "Storyboard.WebPortal.Package", "Storyboard.WebPortal.Package.csproj");
const packageOutput = join(repositoryDirectory, "artifacts", "packages", "nuget");
const packageVersion = JSON.parse(await readFile(join(appDirectory, "package.json"), "utf8")).version;

await mkdir(packageOutput, { recursive: true });

const result = spawnSync(
  "dotnet",
  [
    "pack",
    packageProject,
    "--configuration",
    "Release",
    "--output",
    packageOutput,
    `-p:Version=${packageVersion}`,
    "--nologo"
  ],
  { stdio: "inherit", windowsHide: true }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Packed Storyboard.WebPortal ${packageVersion}.`);