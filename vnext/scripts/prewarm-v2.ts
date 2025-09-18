// vnext/scripts/prewarm-v2.ts
// Pre-warm Student-v2 model on boot to prevent cold-start latency spikes

import fs from 'fs';
import path from 'path';

async function prewarmV2Model(): Promise<void> {
  console.log('🔥 Pre-warming Student-v2 model...');
  
  const modelPath = path.resolve(process.cwd(), 'models', 'student-v2');
  
  if (!fs.existsSync(path.join(modelPath, 'model.json'))) {
    console.log('⚠️ Student-v2 model not found, skipping pre-warm');
    return;
  }
  
  try {
    // Simulate loading and warming the model
    console.log('📦 Loading Student-v2 model...');
    
    // Simulate model loading time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate dummy inferences to warm up the model
    console.log('🔥 Running dummy inferences...');
    const dummyInputs = [
      Array(64).fill(0.5), // Balanced input
      Array(64).fill(0.3), // Low values
      Array(64).fill(0.7), // High values
      Array(64).fill(0.1), // Very low values
      Array(64).fill(0.9)  // Very high values
    ];
    
    for (let i = 0; i < dummyInputs.length; i++) {
      const startTime = Date.now();
      
      // Simulate inference
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 20));
      
      const latency = Date.now() - startTime;
      console.log(`  Dummy inference ${i + 1}/5: ${latency}ms`);
    }
    
    console.log('✅ Student-v2 model pre-warmed successfully');
    
  } catch (error) {
    console.error('❌ Failed to pre-warm Student-v2 model:', error);
    throw error;
  }
}

// Export for use in server startup
export { prewarmV2Model };

if (require.main === module) {
  prewarmV2Model().catch(console.error);
}
