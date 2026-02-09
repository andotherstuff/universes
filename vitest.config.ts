import {defineConfig} from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/lib/lightning/**/*.test.ts"],
    restoreMocks: true,
    setupFiles: ["src/lib/lightning/test/setup.ts"],
  },
})
