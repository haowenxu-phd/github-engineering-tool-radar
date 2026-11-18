import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build work from any sub-path, e.g. https://<user>.github.io/<repo>/
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173 },
});
