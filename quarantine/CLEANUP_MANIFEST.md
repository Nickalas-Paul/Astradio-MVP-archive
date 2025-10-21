# Cleanup Manifest

## Zero Dead Files Report

### Duplicate Scripts Identified
- **File**: `package.json` line 19 vs line 49
- **Issue**: Duplicate `typecheck` scripts
- **Action**: ✅ FIXED - Removed duplicate, kept `typecheck:server`

### Unused Dependencies (Potential)
- **File**: `package.json` dependencies
- **Status**: PENDING - Need to audit actual usage
- **Action**: DEFERRED - Audit after staging soak

### Legacy Routes (Potential)
- **File**: `server/index.js` lines 628-845
- **Issue**: `generateNarrativeFromContext` function appears unused
- **Status**: PENDING - Need to verify no references
- **Action**: DEFERRED - Audit after staging soak

## Zero Duplicates Report

### RNG Functions Consolidated
- **File**: `lib/utils.js` 
- **Action**: ✅ COMPLETED - Consolidated RNG functions
- **Status**: Single source of truth established

### Constants Consolidated  
- **File**: `lib/utils.js`
- **Action**: ✅ COMPLETED - Consolidated planet constants
- **Status**: Single source of truth established

### Typecheck Scripts
- **File**: `package.json`
- **Action**: ✅ COMPLETED - Removed duplicate typecheck
- **Status**: Single script maintained

## Quarantine Candidates (DEFERRED)

### Files to Move After Staging Soak
- **Legacy narrative functions** (if confirmed unused)
- **Unused dependencies** (if confirmed unused)  
- **Duplicate assets** (if any found)
- **Stale environment keys** (if any found)

## Post-Soak Cleanup Plan

### Phase 1: Verification
1. Run staging soak for 24h
2. Monitor for any regressions
3. Verify no references to quarantined files

### Phase 2: Deletion
1. Move confirmed unused files to quarantine
2. Update imports/references
3. Test build and deployment
4. Create deletion PR

### Phase 3: Final Cleanup
1. Delete quarantined files
2. Update documentation
3. Final verification

## Status: PENDING STAGING SOAK
- **Current**: Inventory complete, quarantine ready
- **Next**: Defer deletions until after staging soak
- **Goal**: Zero dead files, zero duplicates
