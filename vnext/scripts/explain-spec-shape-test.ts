/**
 * ExplainSpec Shape Test
 * Assert sections have correct structure: ids in correct order, bullets only in musical section,
 * no "•" in text, no "—" in text.
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
  
  console.log('Running ExplainSpec shape test...');
  
  const result = await api.compose(request) as any;
  const sections = result.explanation?.sections || [];
  
  if (sections.length === 0) {
    console.error('❌ FAIL: No sections returned');
    process.exit(1);
  }
  
  // Check section order: signatures, significance, musical
  const expectedIds = ['signatures', 'significance', 'musical'];
  const actualIds = sections.map((s: any) => s.sectionId);
  
  if (actualIds.length !== expectedIds.length) {
    console.error(`❌ FAIL: Expected ${expectedIds.length} sections, got ${actualIds.length}`);
    process.exit(1);
  }
  
  for (let i = 0; i < expectedIds.length; i++) {
    if (actualIds[i] !== expectedIds[i]) {
      console.error(`❌ FAIL: Section ${i} should be "${expectedIds[i]}", got "${actualIds[i]}"`);
      process.exit(1);
    }
  }
  
  // Check titles
  const expectedTitles = ['Astrological Signatures', 'Personal Significance', 'Musical Identity and Flow'];
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].title !== expectedTitles[i]) {
      console.error(`❌ FAIL: Section ${i} title should be "${expectedTitles[i]}", got "${sections[i].title}"`);
      process.exit(1);
    }
  }
  
  // Check bullets: only musical section should have bullets
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const hasBullets = section.bullets && section.bullets.length > 0;
    
    if (section.sectionId === 'musical') {
      if (!hasBullets) {
        console.error(`❌ FAIL: Musical section should have bullets`);
        process.exit(1);
      }
      if (section.bullets!.length < 3 || section.bullets!.length > 6) {
        console.error(`❌ FAIL: Musical section should have 3-6 bullets, got ${section.bullets!.length}`);
        process.exit(1);
      }
    } else {
      if (hasBullets) {
        console.error(`❌ FAIL: Section "${section.sectionId}" should not have bullets`);
        process.exit(1);
      }
    }
  }
  
  // Check for inline bullet glyphs in text
  for (const section of sections) {
    if (section.text && (section.text.includes('•') || section.text.includes('·'))) {
      console.error(`❌ FAIL: Section "${section.sectionId}" contains inline bullet glyphs in text`);
      console.error(`  Text: ${section.text.substring(0, 200)}...`);
      process.exit(1);
    }
  }
  
  // Check for em dashes in text
  for (const section of sections) {
    if (section.text && (section.text.includes('—') || section.text.includes('–'))) {
      console.error(`❌ FAIL: Section "${section.sectionId}" contains em dashes in text`);
      console.error(`  Text: ${section.text.substring(0, 200)}...`);
      process.exit(1);
    }
  }
  
  // Check bullets don't contain bullet glyphs
  for (const section of sections) {
    if (section.bullets) {
      for (const bullet of section.bullets) {
        if (bullet.includes('•') || bullet.includes('·')) {
          console.error(`❌ FAIL: Bullet contains bullet glyph: ${bullet}`);
          process.exit(1);
        }
      }
    }
  }
  
  console.log('✅ PASS: All shape checks passed');
  console.log(`  Sections: ${sections.length}`);
  console.log(`  Section IDs: ${actualIds.join(', ')}`);
  console.log(`  Musical bullets: ${sections.find((s: any) => s.sectionId === 'musical')?.bullets?.length || 0}`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
