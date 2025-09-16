// scripts/check-placeholders.ts - Detect placeholder/mock code in vNext
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const BAD_PATTERNS = [
  "deterministicPlan(",
  "MOCK",
  "PLACEHOLDER", 
  "TODO(",
  "stub",
  "dummy",
  "fake model",
  "mock model",
  "placeholder model",
  "// TODO:",
  "// FIXME:",
  "// HACK:",
  "// XXX:",
  "student-fallback"
];

const SCOPES = ["vnext", "server"]; // search these directories
let bad: string[] = [];

for (const scope of SCOPES) {
  const walk = (p: string) => {
    try {
      for (const f of readdirSync(p, { withFileTypes: true })) {
        if (f.name.includes("node_modules") || f.name.startsWith(".")) continue;
        
        const full = join(p, f.name);
        if (f.isDirectory()) {
          walk(full);
        } else if (/\.(ts|js|json)$/.test(f.name)) {
          const content = readFileSync(full, "utf8");
          for (const pattern of BAD_PATTERNS) {
            if (content.includes(pattern)) {
              bad.push(`${full} :: ${pattern}`);
            }
          }
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  };
  
  try {
    walk(join(ROOT, scope));
  } catch (error) {
    // Skip directories that don't exist
  }
}

if (bad.length > 0) {
  console.error("❌ Placeholder patterns found:");
  bad.forEach(item => console.error(`   ${item}`));
  console.error(`\n🚨 Found ${bad.length} placeholder violations`);
  process.exit(1);
}

console.log("✅ No placeholder patterns detected");
console.log(`🔍 Scanned ${SCOPES.join(", ")} directories`);
