// The published package (factory ADR 0001, amendment of 09/11/2026; contracts#5): packed with
// `pnpm pack`, as `pnpm publish` does, unpacked into a bare project's node_modules, then loaded by
// Node with type stripping off. Node refuses to strip types under node_modules, so this fails as
// soon as `exports` points back at `src/*.ts`. No network: the runtime dependencies are linked
// from this repository's node_modules instead of being installed. Same layout as db (db#18).
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import * as source from "../src/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const dependencies = z.object({
  dependencies: z.record(z.string(), z.string()).default({}),
  peerDependencies: z.record(z.string(), z.string()).default({}),
});
const manifest = dependencies.extend({
  exports: z.record(z.string(), z.object({ types: z.string(), default: z.string() }).strict()),
});
const NO_STRIP = "--no-strip-types";

/** Runs the pnpm that runs this test (`pnpm run check` sets npm_execpath). */
function pnpm(args: readonly string[], cwd: string): void {
  const execPath = process.env["npm_execpath"];
  if (execPath === undefined) throw new Error("run the tests through pnpm (npm_execpath unset)");
  const [command, prefix] = /\.[cm]?js$/.test(execPath)
    ? [process.execPath, [execPath]]
    : [execPath, []];
  execFileSync(command, [...prefix, ...args], { cwd, stdio: "pipe" });
}

let work: string;
let tarball: string;
let project: string;
let installed: string;

/** Unpacks the tarball as node_modules/@meteo-consensus/contracts and links its dependencies. */
function install(): void {
  const scope = join(project, "node_modules", "@meteo-consensus");
  mkdirSync(scope, { recursive: true });
  // Relative path and cwd: GNU tar reads `D:` in an absolute Windows path as a remote host.
  execFileSync("tar", ["-xzf", join("..", "..", "..", tarball)], { cwd: scope, stdio: "pipe" });
  renameSync(join(scope, "package"), installed);
  const pkg = dependencies.parse(installedJson());
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    const target = join(project, "node_modules", name);
    mkdirSync(join(target, ".."), { recursive: true });
    symlinkSync(realpathSync(join(root, "node_modules", name)), target, "junction");
  }
}

function installedJson(): unknown {
  return JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
}

function installedManifest(): z.infer<typeof manifest> {
  return manifest.parse(installedJson());
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "contracts-pack-"));
  // `pnpm pack` runs `prepack`, which deletes and rebuilds this repository's dist/ during the run.
  pnpm(["pack", "--pack-destination", work], root);
  const packed = readdirSync(work).filter((file) => file.endsWith(".tgz"));
  expect(packed).toHaveLength(1);
  tarball = packed[0] ?? "";
  project = join(work, "consumer");
  installed = join(project, "node_modules", "@meteo-consensus", "contracts");
  install();
  writeFileSync(join(project, "package.json"), '{ "private": true, "type": "module" }\n');
}, 120_000);
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe("packed package", () => {
  it("ships the compiled dist only: no source, test or fixture file", () => {
    const entries = execFileSync("tar", ["-tzf", tarball], { cwd: work, encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.replace(/^package\//, ""));
    expect(entries).toEqual(
      expect.arrayContaining(["package.json", "dist/index.js", "dist/index.d.ts"]),
    );
    for (const entry of entries) {
      expect(entry, entry).toMatch(/^(package\.json|README\.md|dist\/.+\.(js|d\.ts))$/);
      expect(entry, entry).not.toMatch(/\.test\.|(^|\/)(test|fixtures|src)\//);
    }
  });

  it("resolves the root entry to compiled JavaScript and its declarations, types first", () => {
    const { exports } = installedManifest();
    expect(exports).toEqual({
      ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    });
    expect(Object.keys(exports["."] ?? {})).toEqual(["types", "default"]);
    expect(existsSync(join(installed, "dist", "index.d.ts"))).toBe(true);
    expect(existsSync(join(installed, "dist", "index.js"))).toBe(true);
  });

  it("imports the root entry with Node and type stripping off, with the source's exports", () => {
    const script = [
      'const contracts = await import("@meteo-consensus/contracts");',
      "console.log(JSON.stringify({",
      "  keys: Object.keys(contracts).sort(),",
      '  known: contracts.ForecastModelIdSchema.safeParse("arome_france").success,',
      '  unknown: contracts.ForecastModelIdSchema.safeParse("not_a_model").success,',
      "}));",
    ].join("\n");
    const run = spawnSync(process.execPath, [NO_STRIP, "--input-type=module", "--eval", script], {
      cwd: project,
      env: {},
      encoding: "utf8",
    });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({
      keys: Object.keys(source).sort(),
      known: true,
      unknown: false,
    });
  });

  it("type-checks a consumer against the shipped declarations", () => {
    writeFileSync(
      join(project, "consumer.ts"),
      [
        "import {",
        "  type ForecastModelId,",
        "  type ForecastRun,",
        "  ForecastModelIdSchema,",
        "  forecastModelCatalogue,",
        '} from "@meteo-consensus/contracts";',
        'export const id: ForecastModelId = ForecastModelIdSchema.parse("arome_france");',
        "export const catalogue: typeof forecastModelCatalogue = forecastModelCatalogue;",
        'export type RunModel = ForecastRun["model"];',
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          target: "es2024",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    const tsc = join(root, "node_modules", "typescript", "lib", "tsc.js");
    const run = spawnSync(process.execPath, [tsc, "--project", join(project, "tsconfig.json")], {
      cwd: project,
      encoding: "utf8",
    });
    expect(run.stdout).toBe("");
    expect(run.status).toBe(0);
  }, 60_000);
});
