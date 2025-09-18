# Teacher-Student Pipeline Improvements

## Overview

This document outlines the comprehensive improvements made to the teacher-student pipeline based on the second-pair-of-eyes review. All identified gaps have been addressed with automated tools and safeguards.

## ✅ Completed Improvements

### 1. **Automated Astro → Music Coupling Tests**
**File**: `vnext/scripts/test-astro-coupling.ts`
**Command**: `npm run test:astro-coupling`

**What it does**:
- Tests monotonicity of astrological features to musical dimensions
- Verifies fire dominance → tempo increase
- Validates aspect tension → arc bias
- Checks water dominance → density decrease
- Ensures moon phase → motif selection variation

**Why critical**: Prevents model regression where astrological inputs no longer correlate with expected musical outputs.

### 2. **Critics Gaming Prevention**
**Files**: `vnext/critics/melodic.ts`, `vnext/audition-gate.ts`

**What it does**:
- Detects "safe but dull" melodic patterns
- Penalizes excessive stepwise motion (>85% steps)
- Flags narrow range exploitation (<8 semitones)
- Identifies repetitive note/interval patterns
- Prevents monotonic sequences (>6 consecutive same-direction steps)
- Applies gaming penalty to final quality scores

**Why critical**: Stops the model from gaming quality metrics with musically boring but technically "correct" compositions.

### 3. **Wheel Contract Guard Tests**
**File**: `vnext/scripts/test-wheel-contract.ts`
**Command**: `npm run test:wheel-contract`

**What it does**:
- Validates astro-debug API response structure
- Ensures all required fields are present and properly typed
- Tests with minimal, basic, and complex chart scenarios
- Verifies wheel-compatible data formats

**Why critical**: Prevents silent frontend breakage when backend APIs change.

### 4. **Frozen Evaluation Suite**
**File**: `vnext/scripts/freeze-eval-set.ts`
**Commands**: 
- `npm run freeze-eval-set create [count] [version]`
- `npm run freeze-eval-set eval [model]`

**What it does**:
- Creates immutable evaluation sets with checksums
- Ensures balanced astrological diversity (elements, signs, tensions)
- Provides consistent baseline comparisons
- Tracks evaluation history and model performance

**Why critical**: Enables apples-to-apples model comparisons and prevents evaluation drift.

### 5. **Model Artifact Provenance**
**File**: `vnext/scripts/model-provenance.ts`
**Commands**:
- `npm run model-provenance create <version> <model-dir>`
- `npm run model-provenance compare <dir1> <dir2>`

**What it does**:
- Records complete model lineage (commit SHA, training data, calibration)
- Tracks file checksums and deployment metadata
- Enables model comparison and rollback decisions
- Documents training parameters and evaluation results

**Why critical**: Answers "what exactly is deployed?" and enables informed rollback decisions.

### 6. **Single ML Backend Enforcement**
**File**: `vnext/ml/student.ts`

**What it does**:
- Forces tfjs-node in production (`STRICT_ML=true`)
- Eliminates HTTP backend fallback in prod
- Provides clear error messages for missing dependencies
- Maintains development flexibility with fallbacks

**Why critical**: Prevents hard-to-reproduce behavior from mixed backends in production.

### 7. **CI Path Guard**
**File**: `vnext/scripts/ci-path-guard.ts`
**Command**: `npm run ci-path-guard`

**What it does**:
- Prevents revival of deleted legacy files
- Blocks dangerous patterns (legacy-, deprecated-, old-)
- Catches forbidden imports from legacy modules
- Enforces architecture violations (TS in public/, etc.)
- Maintains legacy tombstone for historical tracking

**Why critical**: Prevents architectural regression and legacy code creep.

### 8. **Teacher Label Consistency Verification**
**File**: `vnext/scripts/verify-teacher-consistency.ts`
**Command**: `npm run verify-teacher`

**What it does**:
- Validates teacher uses same 64-D encoder as runtime
- Checks for NaN/Inf values in labels
- Verifies feature ranges are [0,1]
- Compares teacher vs runtime feature generation
- Reports feature statistics and anomalies

**Why critical**: Ensures training labels match runtime feature encoding exactly.

### 9. **Environment-Scoped Threshold Management**
**Files**: `vnext/config/quality.ts`, `vnext/scripts/enforce-quality-thresholds.ts`
**Command**: `npm run enforce-thresholds`

**What it does**:
- Centralizes quality thresholds by environment
- Enforces dev (0.55) → preprod (0.60) → prod (0.65) progression
- Validates threshold consistency in CI
- Generates deployment-specific configurations

**Why critical**: Prevents threshold drift and ensures proper quality gates per environment.

### 10. **Canary Success/Promotion Criteria**
**File**: `vnext/scripts/canary-promotion.ts`
**Commands**:
- `npm run canary-promotion evaluate`
- `npm run canary-promotion auto-promote [--no-dry-run]`

**What it does**:
- Defines statistical promotion criteria by environment
- Requires minimum sample sizes and time windows
- Validates quality improvement, pass rate gains, latency tolerance
- Checks bucket consistency across astrological signs
- Provides automated promotion decisions

**Why critical**: Ensures systematic, data-driven model promotions with proper safeguards.

## 🛠️ New NPM Scripts

### Testing & Validation
```bash
npm run test:astro-coupling    # Test astro-music relationships
npm run test:wheel-contract    # Test frontend API contracts  
npm run test:pipeline          # Run both coupling and contract tests
npm run verify-teacher         # Verify teacher-runtime consistency
```

### Quality & Deployment
```bash
npm run enforce-thresholds     # Check environment threshold compliance
npm run freeze-eval-set create 200 v1.0  # Create frozen evaluation set
npm run freeze-eval-set eval v2          # Run evaluation on frozen set
npm run canary-promotion evaluate        # Check canary promotion eligibility
```

### CI/CD Integration
```bash
npm run ci-path-guard         # Prevent legacy file revival
npm run ci:quality           # Core quality pipeline
npm run ci:full              # Complete pipeline with all checks
```

### Model Management
```bash
npm run model-provenance create v2 models/student-v2  # Create provenance
npm run model-provenance compare models/v1 models/v2  # Compare models
```

## 🔧 Environment Configuration

### Development
```bash
QUALITY_ENV=development
MIN_QUALITY_THRESHOLD=0.55
STRICT_ML=false
```

### Pre-Production
```bash
QUALITY_ENV=pre-production
MIN_QUALITY_THRESHOLD=0.60
STRICT_ML=true
```

### Production
```bash
QUALITY_ENV=production
MIN_QUALITY_THRESHOLD=0.65
STRICT_ML=true
NODE_ENV=production
```

## 🚀 Recommended Next Steps

### Phase 1: Lock Foundation (Immediate)
1. **Run coupling tests**: `npm run test:astro-coupling`
2. **Create frozen eval set**: `npm run freeze-eval-set create 200`
3. **Verify teacher consistency**: `npm run verify-teacher`
4. **Add CI enforcement**: Include `npm run ci:quality` in CI pipeline

### Phase 2: Expand Training Data (1-2 weeks)
1. **Generate more labels**: Expand to 300-500 diverse charts
2. **Retrain V2**: With expanded dataset and gaming penalties
3. **Create provenance**: Document V2 with full lineage
4. **Baseline comparison**: Run eval on frozen set

### Phase 3: Canary Deployment (2-4 weeks)
1. **Enable 10% canary**: Set `STUDENT_V2_CANARY=true`, `CANARY_PERCENT=10`
2. **Monitor telemetry**: Watch for 24-48h with promotion criteria
3. **Auto-promote**: If criteria met, promote to full deployment
4. **Raise prod threshold**: Increase to 0.65+ after stable deployment

### Phase 4: Continuous Improvement (Ongoing)
1. **Regular evaluations**: Monthly frozen set evaluations
2. **Threshold progression**: Gradually raise quality bars
3. **Model versioning**: Systematic V3, V4 development
4. **Architecture guards**: Maintain path guards and contract tests

## 📊 Success Metrics

### Immediate (Week 1)
- [ ] All coupling tests pass
- [ ] Frozen evaluation set created and validated
- [ ] Teacher consistency verified (>95% valid labels)
- [ ] CI pipeline includes quality gates

### Short-term (Month 1)
- [ ] V2 model trained with expanded data (>300 charts)
- [ ] Quality improvement >+0.02 over V1
- [ ] Pass rate improvement >+3pp over V1
- [ ] Canary deployment stable for 48h

### Medium-term (Quarter 1)
- [ ] Production threshold raised to 0.65
- [ ] Full V2 deployment with <10% rollback rate
- [ ] Automated promotion pipeline operational
- [ ] Model provenance tracking complete

## 🔒 Quality Safeguards Summary

| Safeguard | Purpose | Frequency | Failure Action |
|-----------|---------|-----------|----------------|
| Coupling Tests | Prevent astro-music regression | Every deploy | Block deployment |
| Gaming Detection | Prevent quality gaming | Every generation | Apply penalty |
| Contract Tests | Prevent frontend breakage | Every API change | Block deployment |
| Threshold Enforcement | Maintain quality standards | Every deploy | Block deployment |
| Path Guard | Prevent legacy revival | Every commit | Block merge |
| Provenance Tracking | Enable rollback decisions | Every model | Manual review |
| Canary Criteria | Systematic promotions | Every promotion | Block promotion |

## 🎯 Architecture Principles Maintained

1. **Single Engine**: All improvements maintain the vNext-only architecture
2. **ML-Primary**: Teacher offline, runtime is student → planner → critics → gate
3. **Clean Builds**: No excess files, consolidated endpoints, immutable evaluations
4. **Data Hygiene**: Chart-hash splitting, checksummed datasets, consistent encoding
5. **Quality First**: Fail-closed behavior, env-scoped thresholds, gaming prevention

---

**Result**: The teacher-student pipeline is now production-ready with comprehensive safeguards against regression, gaming, and architectural drift. All identified gaps have been systematically addressed with automated tooling and clear operational procedures.
