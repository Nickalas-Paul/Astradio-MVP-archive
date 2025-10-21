// Simple drift-guard verification script
// Checks for single compose handler and no legacy routes

const fs = require('fs');
const path = require('path');

console.log('🛡️  Verifying Drift Guard - Single Compose Handler');
console.log('=' .repeat(50));

// Check server/index.js for compose handlers
const serverFile = path.join(__dirname, '..', 'server', 'index.js');
const serverContent = fs.readFileSync(serverFile, 'utf8');

// Count compose handlers
const composeHandlers = serverContent.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]\/api\/compose/g) || [];
const legacyRoutes = serverContent.match(/app\.all.*\/api\/(vnext\/)?(render|astro-debug)/g) || [];
const hasDeprecatedRoute = serverContent.includes('deprecated_route');

console.log(`📊 Compose Handlers Found: ${composeHandlers.length}`);
console.log(`📊 Legacy Routes Found: ${legacyRoutes.length}`);

// Check for single compose handler
const hasSingleCompose = composeHandlers.length === 1;
const hasDeprecatedLegacy = legacyRoutes.length > 0 || hasDeprecatedRoute;

console.log(`✅ Single Compose Handler: ${hasSingleCompose ? 'YES' : 'NO'}`);
console.log(`✅ Legacy Routes Deprecated: ${hasDeprecatedLegacy ? 'YES' : 'NO'}`);

// Check for drift-guard patterns
const hasDriftGuard = serverContent.includes('DEPRECATE_LEGACY_ROUTES');
const hasUnifiedSpec = serverContent.includes('UnifiedSpecV1.1') || serverContent.includes('vnextCompose');

console.log(`✅ Drift Guard Active: ${hasDriftGuard ? 'YES' : 'NO'}`);
console.log(`✅ Unified Spec V1.1: ${hasUnifiedSpec ? 'YES' : 'NO'}`);

const allPassed = hasSingleCompose && hasDeprecatedLegacy && hasDriftGuard && hasUnifiedSpec;

console.log('=' .repeat(50));
console.log(`🎯 Drift Guard Results: ${allPassed ? 'PASSED' : 'FAILED'}`);

if (!allPassed) {
  console.log('\n💡 Issues found:');
  if (!hasSingleCompose) console.log('   - Multiple compose handlers detected');
  if (!hasDeprecatedLegacy) console.log('   - Legacy routes not properly deprecated');
  if (!hasDriftGuard) console.log('   - Drift guard not active');
  if (!hasUnifiedSpec) console.log('   - Unified Spec V1.1 not enforced');
}

process.exit(allPassed ? 0 : 1);
