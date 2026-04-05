import path from "node:path";
import { fileURLToPath } from "node:url";

const landingDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: {
      config: path.join(landingDir, "tailwind.config.ts"),
    },
    autoprefixer: {},
  },
};
