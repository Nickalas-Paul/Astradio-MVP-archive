/**
 * Model Loader with Integrity Validation and Automatic Rollback
 * Phase-6 Integration: v2.8 with v2.7 fallback
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ModelRegistry {
  models: Array<{
    id: string;
    version: string;
    status: string;
    artifacts: {
      tfjs_path: string;
      integrity_hash: string;
    };
    rollback_target: string | null;
  }>;
  registry_metadata: {
    active_model: string;
  };
}

interface IntegrityMap {
  model: string;
  version: string;
  files: Record<string, {
    sha256: string;
    size: number;
  }>;
}

export class ModelLoader {
  private registry: ModelRegistry;
  private currentModel: string;
  private rollbackTarget: string | null;

  constructor() {
    this.registry = this.loadRegistry();
    this.currentModel = process.env.RUNTIME_MODEL || this.registry.registry_metadata.active_model;
    this.rollbackTarget = this.getRollbackTarget(this.currentModel);
  }

  /**
   * Load and validate model with integrity checks
   */
  async loadModel(): Promise<{ modelId: string; rollbackTaken: boolean }> {
    console.log(`🎯 Loading model: ${this.currentModel}`);
    
    try {
      // Validate model integrity
      const isValid = await this.validateModelIntegrity(this.currentModel);
      
      if (!isValid) {
        console.warn(`⚠️  Model ${this.currentModel} failed integrity check, rolling back to ${this.rollbackTarget}`);
        return await this.performRollback();
      }
      
      console.log(`✅ Model ${this.currentModel} integrity validated`);
      return { modelId: this.currentModel, rollbackTaken: false };
      
    } catch (error) {
      console.error(`❌ Error loading model ${this.currentModel}:`, error);
      return await this.performRollback();
    }
  }

  /**
   * Validate model integrity using checksums
   */
  private async validateModelIntegrity(modelId: string): Promise<boolean> {
    const modelInfo = this.registry.models.find(m => m.id === modelId);
    if (!modelInfo) {
      throw new Error(`Model ${modelId} not found in registry`);
    }

    const tfjsPath = modelInfo.artifacts.tfjs_path;
    const integrityPath = path.join(tfjsPath, 'integrity.json');
    
    if (!fs.existsSync(integrityPath)) {
      console.warn(`Integrity map not found for ${modelId}`);
      return false;
    }

    const integrity: IntegrityMap = JSON.parse(fs.readFileSync(integrityPath, 'utf8'));
    
    // Validate each file
    for (const [filename, expected] of Object.entries(integrity.files)) {
      const filePath = path.join(tfjsPath, filename);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`File ${filename} missing for ${modelId}`);
        return false;
      }

      const actualHash = await this.calculateFileHash(filePath);
      if (actualHash !== expected.sha256) {
        console.warn(`Hash mismatch for ${filename}: expected ${expected.sha256}, got ${actualHash}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Perform automatic rollback to fallback model
   */
  private async performRollback(): Promise<{ modelId: string; rollbackTaken: boolean }> {
    if (!this.rollbackTarget) {
      throw new Error('No rollback target available');
    }

    console.log(`🔄 Rolling back to ${this.rollbackTarget}`);
    
    // Validate rollback target
    const isValid = await this.validateModelIntegrity(this.rollbackTarget);
    if (!isValid) {
      throw new Error(`Rollback target ${this.rollbackTarget} also failed integrity check`);
    }

    this.currentModel = this.rollbackTarget;
    this.rollbackTarget = this.getRollbackTarget(this.rollbackTarget);
    
    console.log(`✅ Rollback successful to ${this.currentModel}`);
    return { modelId: this.currentModel, rollbackTaken: true };
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return `sha256:${hash.digest('hex')}`;
  }

  /**
   * Load model registry
   */
  private loadRegistry(): ModelRegistry {
    const registryPath = path.join(process.cwd(), 'models', 'registry.json');
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  }

  /**
   * Get rollback target for a model
   */
  private getRollbackTarget(modelId: string): string | null {
    const modelInfo = this.registry.models.find(m => m.id === modelId);
    return modelInfo?.rollback_target || null;
  }

  /**
   * Simulate corrupt shard for testing
   */
  async simulateCorruptShard(): Promise<boolean> {
    console.log('🧪 Simulating corrupt shard test...');
    
    // Temporarily corrupt a shard file
    const modelInfo = this.registry.models.find(m => m.id === this.currentModel);
    if (!modelInfo) return false;

    const shardPath = path.join(modelInfo.artifacts.tfjs_path, 'group1-shard1of1.bin');
    if (!fs.existsSync(shardPath)) return false;

    // Backup original
    const backupPath = shardPath + '.backup';
    fs.copyFileSync(shardPath, backupPath);
    
    // Corrupt the file
    fs.writeFileSync(shardPath, 'corrupted data');
    
    try {
      // Test integrity validation
      const isValid = await this.validateModelIntegrity(this.currentModel);
      
      // Restore original
      fs.copyFileSync(backupPath, shardPath);
      fs.unlinkSync(backupPath);
      
      return !isValid; // Should return false (invalid) for corrupt shard
    } catch (error) {
      // Restore original on error
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, shardPath);
        fs.unlinkSync(backupPath);
      }
      return true; // Error means corruption was detected
    }
  }

  /**
   * Get current model info
   */
  getCurrentModelInfo() {
    return {
      model_id: this.currentModel,
      rollback_target: this.rollbackTarget,
      registry_hash: this.registry.registry_metadata.active_model
    };
  }
}

// Export singleton instance
export const modelLoader = new ModelLoader();

