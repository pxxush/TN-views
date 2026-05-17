import esbuild from "esbuild";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  outfile: "main.js",
  target: "es2016",
  logLevel: "info",
}).catch(() => process.exit(1));
