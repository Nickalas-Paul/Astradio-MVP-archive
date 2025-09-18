// vnext/scripts/audit-boundaries.ts
// Audit script to enforce architectural boundaries and prevent rule drift
// Run this in CI to catch violations before they reach production

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface AuditResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
}

export function auditArchitecturalBoundaries(): AuditResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  
  console.log("🔍 Auditing architectural boundaries...");
  
  // 1. Check for teacher imports in runtime code
  console.log("  📋 Checking teacher imports in runtime...");
  const runtimePaths = [
    "vnext/api",
    "vnext/planner", 
    "vnext/astro",
    "vnext/ml"
  ];
  
  // Check directories
  for (const runtimePath of runtimePaths) {
    const files = findTsFiles(runtimePath);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('from "../teacher/') || content.includes('from "./teacher/')) {
        violations.push(`RUNTIME_IMPORT_VIOLATION: ${file} imports from teacher/`);
      }
    }
  }
  
  // Check individual files
  const individualFiles = [
    "vnext/plan-generator.ts",
    "vnext/audition-gate.ts"
  ];
  
  for (const file of individualFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('from "../teacher/') || content.includes('from "./teacher/')) {
        violations.push(`RUNTIME_IMPORT_VIOLATION: ${file} imports from teacher/`);
      }
    }
  }
  
  // 2. Check for hardcoded thresholds outside config
  console.log("  📋 Checking for hardcoded thresholds...");
  const allFiles = findTsFiles("vnext");
  for (const file of allFiles) {
    if (file.includes("config/quality.ts")) continue; // Skip the config file itself
    
    const content = fs.readFileSync(file, 'utf8');
    const hardcodedThresholds = [
      /0\.6[5-9]/,  // 0.65-0.69
      /0\.7[0-9]/,  // 0.70-0.79
      /MIN_QUALITY|MIN_RULE_QUALITY/
    ];
    
    for (const pattern of hardcodedThresholds) {
      if (pattern.test(content)) {
        warnings.push(`HARDCODED_THRESHOLD: ${file} may have hardcoded quality thresholds`);
      }
    }
  }
  
  // 3. Check for chartContext usage outside designated areas
  console.log("  📋 Checking chartContext boundaries...");
  const allowedChartContextPaths = [
    "vnext/api/",
    "vnext/feature-encode.ts",
    "vnext/astro/guidance.ts"
  ];
  
  for (const file of allFiles) {
    if (file.includes("chartContext") && !isInAllowedPath(file, allowedChartContextPaths)) {
      violations.push(`CHART_CONTEXT_VIOLATION: ${file} accesses chartContext outside designated areas`);
    }
  }
  
  // 4. Check for multiple encoder definitions (not usage)
  console.log("  📋 Checking for duplicate encoder definitions...");
  const encoderDefinitionFiles = allFiles.filter(f => {
    const content = fs.readFileSync(f, 'utf8');
    return content.includes('export function encodeFeatures(') && 
           !f.includes('feature-encode.ts') &&
           !f.includes('audit-boundaries.ts'); // Exclude this audit script
  });
  
  if (encoderDefinitionFiles.length > 0) {
    violations.push(`MULTIPLE_ENCODER_DEFINITIONS: Found encodeFeatures() definition in ${encoderDefinitionFiles.join(', ')}`);
  }
  
  // 5. Check for legacy paths
  console.log("  📋 Checking for legacy paths...");
  const legacyPaths = ["audition/", "Backend/"];
  for (const legacyPath of legacyPaths) {
    if (fs.existsSync(legacyPath)) {
      violations.push(`LEGACY_PATH_EXISTS: ${legacyPath} should be archived`);
    }
  }
  
  const passed = violations.length === 0;
  
  if (passed) {
    console.log("✅ All architectural boundaries respected");
  } else {
    console.log(`❌ Found ${violations.length} violations`);
    violations.forEach(v => console.log(`  - ${v}`));
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  Found ${warnings.length} warnings`);
    warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  return { passed, violations, warnings };
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walkDir(currentPath: string) {
    if (!fs.existsSync(currentPath)) return;
    
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

function isInAllowedPath(file: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(allowedPath => file.includes(allowedPath));
}

// CLI interface
if (require.main === module) {
  const result = auditArchitecturalBoundaries();
  
  if (!result.passed) {
    console.error("❌ Architectural boundary audit failed");
    process.exit(1);
  } else {
    console.log("✅ Architectural boundary audit passed");
    process.exit(0);
  }
}
