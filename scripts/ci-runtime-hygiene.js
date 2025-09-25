#!/usr/bin/env node
/**
 * CI Runtime Hygiene Check
 * Ensures no runtime imports of .ts or source .js files outside dist/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findFiles(dir, pattern) {
  const results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      results.push(...findFiles(fullPath, pattern));
    } else if (stat.isFile() && pattern.test(file)) {
      results.push(fullPath);
    }
  }
  
  return results;
}

function scanForViolations() {
  const violations = [];
  
  // Find all runtime JS files
  const jsFiles = [
    ...findFiles('server', /\.js$/),
    ...findFiles('dist', /\.js$/)
  ];
  
  console.log(`Scanning ${jsFiles.length} runtime JS files for violations...`);
  
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Check for .ts imports (but exclude script utilities that legitimately work with .ts files)
      if (/require\(['"]\.*\/.*\.ts['"]\)/.test(line) && !file.includes('scripts/')) {
        violations.push({
          file,
          line: lineNum,
          content: line.trim(),
          type: 'ts_import',
          message: 'Runtime import of .ts file detected'
        });
      }
      
      // Check for source .js imports in routes/ (should use dist/)
      if (/require\(['"]\.\.\/routes\/(users|library)['"]\)/.test(line)) {
        violations.push({
          file,
          line: lineNum,
          content: line.trim(),
          type: 'source_js_import',
          message: 'Import of source .js file instead of compiled dist/ version'
        });
      }
      
      // Check for legacy_quarantine references
      if (/legacy_quarantine/.test(line)) {
        violations.push({
          file,
          line: lineNum,
          content: line.trim(),
          type: 'quarantine_reference',
          message: 'Reference to legacy_quarantine directory detected'
        });
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 CI Runtime Hygiene Check');
  console.log('============================');
  
  const violations = scanForViolations();
  
  if (violations.length === 0) {
    console.log('✅ PASS: No runtime hygiene violations found');
    console.log('   • No .ts imports in runtime JS');
    console.log('   • No source .js imports outside dist/');
    console.log('   • No legacy_quarantine references');
    process.exit(0);
  } else {
    console.log(`❌ FAIL: ${violations.length} runtime hygiene violations found:`);
    console.log();
    
    for (const violation of violations) {
      console.log(`  ${violation.type.toUpperCase()}: ${violation.file}:${violation.line}`);
      console.log(`    ${violation.message}`);
      console.log(`    ${violation.content}`);
      console.log();
    }
    
    console.log('💡 Fix: Ensure all runtime code imports only compiled JS from dist/');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scanForViolations };
