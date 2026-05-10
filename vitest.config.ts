import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@db:5432/app_test",
    },
  },
});
