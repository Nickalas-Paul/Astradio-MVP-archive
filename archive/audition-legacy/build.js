#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Teacher Audition system...');

try {
  // Clean dist directory
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  fs.mkdirSync('dist');

  // Compile TypeScript
  execSync('npx tsc', { stdio: 'inherit' });

  // Copy compiled JS files to public directory
  const publicDir = path.join(__dirname, '..', 'public', 'audition');
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true });
  }
  fs.mkdirSync(publicDir, { recursive: true });

  // Copy all .js files from dist to public/audition
  const distFiles = fs.readdirSync('dist');
  distFiles.forEach(file => {
    if (file.endsWith('.js')) {
      fs.copyFileSync(path.join('dist', file), path.join(publicDir, file));
    }
  });

  console.log('✅ Build complete! Files copied to public/audition/');
  console.log('📁 Generated files:', distFiles.filter(f => f.endsWith('.js')));

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
