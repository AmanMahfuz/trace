// Fails the build if components bypass the system.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const rules = [
  { name: "hex color", re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "raw px value in className", re: /\[\d+px\]/ },
  { name: "shadcn Card import", re: /components\/ui\/card/ },
  { name: "dark: variant", re: /\bdark:/ },
];

const skip = ["tokens.css", "tokens.json", "node_modules", ".next"];
let failures = 0;

const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (skip.some((s) => p.includes(s))) continue;
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(f)) continue;
    const text = readFileSync(p, "utf8");
    for (const r of rules) {
      if (r.re.test(text)) {
        console.error(`${p}: ${r.name}`);
        failures++;
      }
    }
  }
};

walk("src");
if (failures > 0) {
  console.error(`Design system check failed with ${failures} violations.`);
} else {
  console.log("Design system check passed: 0 violations.");
}
process.exit(failures ? 1 : 0);
