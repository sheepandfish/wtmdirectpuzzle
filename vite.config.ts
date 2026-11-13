import { defineConfig } from "vite";

export default defineConfig({
  server: { host: true, port: 5173, strictPort: true },
  preview: { port: 5173 },
  test: {
    include: ["src/tests/**/*.test.ts"],
  },
});
