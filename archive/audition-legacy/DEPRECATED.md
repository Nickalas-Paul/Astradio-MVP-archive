# ⚠️ DEPRECATED: Audition System

**This folder is deprecated as of the infrastructure cleanup.**

## Status: ARCHIVED

The audition system has been consolidated into the **vnext/** system for the following reasons:

1. **Duplicate Functionality**: Both systems did ML-based music generation
2. **Architectural Mismatch**: Different approaches (teacher vs student models)
3. **Code Duplication**: Quality gates, feature encoding, composition generation
4. **Maintenance Burden**: Two systems doing the same thing

## What Was Preserved

- **Telemetry functionality** → Moved to `vnext/logger.ts`
- **Quality evaluation logic** → Enhanced in `vnext/critics/`
- **Useful diagnostic patterns** → Integrated into vnext system

## Migration Path

- **Use vnext system**: All ML functionality is now in `vnext/`
- **API endpoints**: Use `/api/vnext/compose` instead of audition endpoints
- **Quality gates**: Use `vnext/audition-gate.ts` instead of `audition/quality-gates.ts`
- **Logging**: Use `vnext/logger.ts` with telemetry instead of `audition/telemetry.ts`

## Files in This Folder

- `audition-runner.ts` → **DEPRECATED** - Use `vnext/plan-generator.ts`
- `teacher.ts` → **DEPRECATED** - Use `vnext/ml/student.ts`
- `generator.ts` → **DEPRECATED** - Use `vnext/planner/narrative.ts`
- `quality-gates.ts` → **DEPRECATED** - Use `vnext/audition-gate.ts`
- `telemetry.ts` → **MIGRATED** - Now in `vnext/logger.ts`
- `contracts.ts` → **DEPRECATED** - Use `vnext/contracts.ts`

## Removal Date

This folder will be removed in a future cleanup after confirming all functionality has been migrated to vnext.

**Last Updated**: Infrastructure Cleanup - Phase 1
