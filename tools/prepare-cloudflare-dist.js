const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const EXCLUDED_ROOT_ENTRIES = new Set([
  ".git",
  "dist",
  "node_modules",
  "tools",
  "package-lock.json",
  "package.json",
]);

function ensureInsideRoot(target) {
  const root = ROOT.toLowerCase();
  const resolved = path.resolve(target).toLowerCase();

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Unsafe path outside repository: ${target}`);
  }
}

function copyPublicFiles() {
  ensureInsideRoot(DIST_DIR);
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (EXCLUDED_ROOT_ENTRIES.has(entry.name)) {
      continue;
    }

    const source = path.join(ROOT, entry.name);
    const target = path.join(DIST_DIR, entry.name);

    if (entry.isDirectory()) {
      fs.cpSync(source, target, {
        recursive: true,
        filter: (src) => {
          const base = path.basename(src);
          return base !== ".git" && base !== "node_modules" && base !== "dist";
        },
      });
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}

copyPublicFiles();
console.log("Cloudflare Pages output prepared in dist/.");
