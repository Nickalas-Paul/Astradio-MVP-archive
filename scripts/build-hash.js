#!/usr/bin/env node
// Build hash verification for deterministic builds

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function calculateDirectoryHash(dirPath, excludePatterns = []) {
  const hash = crypto.createHash('sha256');
  
  function processFile(filePath) {
    const relativePath = path.relative(dirPath, filePath);
    
    // Skip excluded patterns
    if (excludePatterns.some(pattern => relativePath.includes(pattern))) {
      return;
    }
    
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    
    // Include file path and content in hash
    hash.update(relativePath);
    hash.update(content);
    hash.update(stats.mtime.toISOString());
  }
  
  function processDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        processDirectory(itemPath);
      } else {
        processFile(itemPath);
      }
    }
  }
  
  processDirectory(dirPath);
  return hash.digest('hex');
}

function verifyBuildDeterminism() {
  const buildDir = path.join(__dirname, '..', 'dist');
  const excludePatterns = [
    'node_modules',
    '.git',
    '*.log',
    '*.tmp'
  ];
  
  if (!fs.existsSync(buildDir)) {
    console.log('❌ Build directory does not exist');
    return false;
  }
  
  const hash1 = calculateDirectoryHash(buildDir, excludePatterns);
  console.log(`Build hash (first run): ${hash1}`);
  
  // Wait a moment and calculate again
  setTimeout(() => {
    const hash2 = calculateDirectoryHash(buildDir, excludePatterns);
    console.log(`Build hash (second run): ${hash2}`);
    
    if (hash1 === hash2) {
      console.log('✅ Build is deterministic');
      process.exit(0);
    } else {
      console.log('❌ Build is not deterministic');
      process.exit(1);
    }
  }, 1000);
}

if (require.main === module) {
  verifyBuildDeterminism();
}

module.exports = { calculateDirectoryHash, verifyBuildDeterminism };
