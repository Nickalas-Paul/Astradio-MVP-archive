/**
 * ExplainSpec Determinism Test
 * Run compose twice with identical inputs, assert sections are identical.
 */

import { ComposeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';

async function main(): Promise<void> {
  const api = new ComposeAPI();
  
  const request: ComposeRequest = {
    mode: 'sky',
    skyParams: {
      latitude: 38.9072,
      longitude: -77.0369,
      datetime: '2026-02-08T12:00:00Z'
    }
  };
  
  console.log('Running ExplainSpec determinism test...');
  console.log('Request:', JSON.stringify(request, null, 2));
  
  // First run
  const result1 = await api.compose(request);
  const sections1 = result1.explanation?.sections || [];
  
  // Second run (identical inputs)
  const result2 = await api.compose(request);
  const sections2 = result2.explanation?.sections || [];
  
  // Assert sections are identical
  if (sections1.length !== sections2.length) {
    console.error(`❌ FAIL: Section count mismatch: ${sections1.length} vs ${sections2.length}`);
    process.exit(1);
  }
  
  for (let i = 0; i < sections1.length; i++) {
    const s1 = sections1[i];
    const s2 = sections2[i];
    
    if (s1.sectionId !== s2.sectionId) {
      console.error(`❌ FAIL: Section ${i} id mismatch: ${s1.sectionId} vs ${s2.sectionId}`);
      process.exit(1);
    }
    
    if (s1.title !== s2.title) {
      console.error(`❌ FAIL: Section ${i} title mismatch: ${s1.title} vs ${s2.title}`);
      process.exit(1);
    }
    
    if (s1.text !== s2.text) {
      console.error(`❌ FAIL: Section ${i} text mismatch:`);
      console.error(`  Run 1: ${s1.text?.substring(0, 100)}...`);
      console.error(`  Run 2: ${s2.text?.substring(0, 100)}...`);
      process.exit(1);
    }
    
    const bullets1 = s1.bullets || [];
    const bullets2 = s2.bullets || [];
    if (bullets1.length !== bullets2.length) {
      console.error(`❌ FAIL: Section ${i} bullets length mismatch: ${bullets1.length} vs ${bullets2.length}`);
      process.exit(1);
    }
    
    for (let j = 0; j < bullets1.length; j++) {
      if (bullets1[j] !== bullets2[j]) {
        console.error(`❌ FAIL: Section ${i} bullet ${j} mismatch: ${bullets1[j]} vs ${bullets2[j]}`);
        process.exit(1);
      }
    }
  }
  
  console.log('✅ PASS: Sections are identical across runs');
  console.log(`  Sections: ${sections1.length}`);
  console.log(`  Section IDs: ${sections1.map(s => s.sectionId).join(', ')}`);
  console.log(`  Titles: ${sections1.map(s => s.title).join(', ')}`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
