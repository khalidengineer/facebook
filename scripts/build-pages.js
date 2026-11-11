const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const apiDir = path.join(__dirname, "..", "src", "app", "api");
const tempApiDir = path.join(__dirname, "..", "src", "api-routes-temp");
const outDir = path.join(__dirname, "..", "out");

let moved = false;

try {
  if (fs.existsSync(apiDir)) {
    console.log("Temporarily moving src/app/api to allow Next.js static export...");
    fs.renameSync(apiDir, tempApiDir);
    moved = true;
  }

  console.log("Running next build with static export...");
  execSync("npx next build", {
    stdio: "inherit",
    env: { ...process.env, NEXT_EXPORT: "true" },
  });

  if (fs.existsSync(outDir)) {
    fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
    console.log("Created out/.nojekyll for GitHub Pages");
  }
} finally {
  if (moved && fs.existsSync(tempApiDir)) {
    console.log("Restoring src/app/api...");
    fs.renameSync(tempApiDir, apiDir);
  }
}
