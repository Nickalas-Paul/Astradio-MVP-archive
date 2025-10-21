#!/usr/bin/env node

/**
 * Drift Guard: Ensures only one /api/compose handler exists
 * Fails the build if multiple compose handlers are detected
 */

const fs = require('fs');
const path = require('path');

function findComposeHandlers() {
  const handlers = [];
  
  // Check Next.js API routes
  const nextApiDir = path.join(__dirname, '..', 'app', 'api');
  if (fs.existsSync(nextApiDir)) {
    const composeRoute = path.join(nextApiDir, 'compose', 'route.ts');
    if (fs.existsSync(composeRoute)) {
      handlers.push({
        type: 'Next.js Proxy',
        path: composeRoute,
        relative: 'app/api/compose/route.ts',
        allowed: true
      });
    }
  }
  
  // Check Express server for compose mount
  const serverFile = path.join(__dirname, '..', 'server', 'index.js');
  if (fs.existsSync(serverFile)) {
    const content = fs.readFileSync(serverFile, 'utf8');
    if (content.includes('app.post("/api/compose"') || content.includes('app.post(\'/api/compose\'')) {
      handlers.push({
        type: 'Express Mount',
        path: serverFile,
        relative: 'server/index.js',
        allowed: true
      });
    }
  }
  
  // Check vNext compose handler
  const vnextCompose = path.join(__dirname, '..', 'vnext', 'api', 'compose.ts');
  if (fs.existsSync(vnextCompose)) {
    handlers.push({
      type: 'vNext Handler',
      path: vnextCompose,
      relative: 'vnext/api/compose.ts',
      allowed: true
    });
  }
  
  // Check for any other compose routes (not allowed)
  const allowedPatterns = [
    'app\\api\\compose\\route.ts',
    'app/api/compose/route.ts',
    'server\\index.js',
    'server/index.js',
    'vnext\\api\\compose.ts',
    'vnext/api/compose.ts'
  ];
  
  // Search for other potential compose handlers
  const searchDirs = [
    path.join(__dirname, '..', 'app', 'api'),
    path.join(__dirname, '..', 'routes'),
    path.join(__dirname, '..', 'src', 'api')
  ];
  
  searchDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir, { recursive: true });
      files.forEach(file => {
        if (typeof file === 'string' && file.includes('compose')) {
          const fullPath = path.join(dir, file);
          const relative = path.relative(path.join(__dirname, '..'), fullPath);
          const normalizedRelative = relative.replace(/\\/g, '/');
          
          // Skip directories
          if (fs.statSync(fullPath).isDirectory()) {
            return;
          }
          
          if (!allowedPatterns.some(pattern => {
            const normalizedPattern = pattern.replace(/\\/g, '/');
            return normalizedRelative === normalizedPattern || normalizedRelative.endsWith(normalizedPattern);
          })) {
            handlers.push({
              type: 'Unauthorized',
              path: fullPath,
              relative: relative,
              allowed: false
            });
          }
        }
      });
    }
  });
  
  return handlers;
}

function main() {
  console.log('🔍 Checking compose handler architecture...');
  
  const handlers = findComposeHandlers();
  const allowedHandlers = handlers.filter(h => h.allowed);
  const unauthorizedHandlers = handlers.filter(h => !h.allowed);
  
  if (allowedHandlers.length === 0) {
    console.error('❌ No allowed /api/compose handlers found!');
    process.exit(1);
  }
  
  if (unauthorizedHandlers.length > 0) {
    console.error('❌ Unauthorized compose handlers detected:');
    unauthorizedHandlers.forEach(handler => {
      console.error(`   - ${handler.type}: ${handler.relative}`);
    });
    console.error('');
    console.error('Only these handlers are allowed:');
    console.error('   - Next.js Proxy: app/api/compose/route.ts');
    console.error('   - Express Mount: server/index.js');
    console.error('   - vNext Handler: vnext/api/compose.ts');
    process.exit(1);
  }
  
  console.log('✅ Valid compose architecture detected:');
  allowedHandlers.forEach(handler => {
    console.log(`   - ${handler.type}: ${handler.relative}`);
  });
  console.log('');
  console.log('Architecture: Next.js → Express → vNext (single engine)');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { findComposeHandlers };
