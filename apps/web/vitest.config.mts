import { defineConfig } from "vitest/config";

/**
 * Vitest for the `lib/*` modules.
 *
 * `environment: "node"` is deliberate: no unit test in this repo touches the
 * DOM or the network, so pulling in a DOM implementation would add a dependency
 * for nothing. The one module that reads `sessionStorage` stubs it.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
