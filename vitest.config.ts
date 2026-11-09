import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    sequence: { shuffle: true },
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/main.ts"],
      thresholds: {
        "src/domain/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "src/app/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
