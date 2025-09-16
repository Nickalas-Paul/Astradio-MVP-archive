// scripts/check-fallback-share.ts - Validate fallback usage in audit logs
import { readFileSync } from "fs";
import path from "path";

const AUDIT_LOG_PATH = path.join(process.cwd(), "logs", "audit.jsonl");

let total = 0;
let fallback = 0;
let student = 0;
let retrieval = 0;

try {
  const content = readFileSync(AUDIT_LOG_PATH, "utf8");
  const lines = content.trim().split("\n").filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      total++;
      
      if (entry.source === "student-fallback") {
        fallback++;
      } else if (entry.source === "student") {
        student++;
      } else if (entry.source === "retrieval+refiner") {
        retrieval++;
      }
    } catch (parseError) {
      // Skip malformed JSON lines
    }
  }
} catch (fileError) {
  console.warn("⚠️ No audit log found - this is normal for fresh deployments");
  console.log("📊 Fallback share: 0/0 (no data)");
  process.exit(0);
}

const fallbackShare = total > 0 ? (fallback / total) : 0;
const studentShare = total > 0 ? (student / total) : 0;
const retrievalShare = total > 0 ? (retrieval / total) : 0;

console.log("📊 Audit Log Analysis:");
console.log(`   Total entries: ${total}`);
console.log(`   Student: ${student} (${(studentShare * 100).toFixed(1)}%)`);
console.log(`   Retrieval: ${retrieval} (${(retrievalShare * 100).toFixed(1)}%)`);
console.log(`   Fallback: ${fallback} (${(fallbackShare * 100).toFixed(1)}%)`);

// Strict ML mode validation
if (process.env.STRICT_ML === "true" && fallback > 0) {
  console.error(`❌ STRICT_ML violation: ${fallback}/${total} fallback events`);
  console.error("🚨 Production mode does not allow fallback usage");
  process.exit(1);
}

// Warning thresholds
if (fallbackShare > 0.05) {
  console.warn(`⚠️ High fallback usage: ${(fallbackShare * 100).toFixed(1)}%`);
}

if (studentShare < 0.75) {
  console.warn(`⚠️ Low student usage: ${(studentShare * 100).toFixed(1)}%`);
}

console.log("✅ Fallback share validation passed");
