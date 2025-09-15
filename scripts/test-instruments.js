const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  soundfonts: [
    'rhodes.sf2',
    'upright_bass.sf2', 
    'grand_piano.sf2',
    'strings_ensemble.sf2',
    'clarinet.sf2',
    'flute.sf2',
    'french_horn.sf2',
    'pad_choir.sf2'
  ],
  drumKits: [
    '808',
    '909', 
    'jazz',
    'orch'
  ],
  samples: [
    'pads/shimmer.wav',
    'bells/mallet_c4.wav',
    'lofi/vinyl_loop.wav'
  ],
  irs: [
    'hall.wav',
    'plate.wav', 
    'room.wav'
  ]
};

function checkFileExists(filepath) {
  try {
    const stats = fs.statSync(filepath);
    return {
      exists: true,
      size: stats.size,
      sizeKB: Math.round(stats.size / 1024)
    };
  } catch (error) {
    return { exists: false, size: 0, sizeKB: 0 };
  }
}

function testInstruments() {
  console.log('🎵 INSTRUMENT TESTING REPORT\n');
  
  let totalFiles = 0;
  let existingFiles = 0;
  let totalSize = 0;
  
  // Test SoundFonts
  console.log('🎹 SOUNDFONTS:');
  TEST_CONFIG.soundfonts.forEach(filename => {
    const filepath = path.join('public/audio/soundfonts', filename);
    const result = checkFileExists(filepath);
    totalFiles++;
    
    if (result.exists) {
      existingFiles++;
      totalSize += result.size;
      console.log(`   ✅ ${filename} (${result.sizeKB}KB)`);
    } else {
      console.log(`   ❌ ${filename} (MISSING)`);
    }
  });
  
  // Test Drum Kits
  console.log('\n🥁 DRUM KITS:');
  TEST_CONFIG.drumKits.forEach(kitName => {
    const kitDir = path.join('public/audio/samples/drums', kitName);
    const requiredFiles = ['kick.wav', 'snare.wav', 'hat.wav'];
    
    console.log(`   📁 ${kitName}/`);
    requiredFiles.forEach(filename => {
      const filepath = path.join(kitDir, filename);
      const result = checkFileExists(filepath);
      totalFiles++;
      
      if (result.exists) {
        existingFiles++;
        totalSize += result.size;
        console.log(`      ✅ ${filename} (${result.sizeKB}KB)`);
      } else {
        console.log(`      ❌ ${filename} (MISSING)`);
      }
    });
  });
  
  // Test Samples
  console.log('\n🎵 SAMPLES:');
  TEST_CONFIG.samples.forEach(relativePath => {
    const filepath = path.join('public/audio/samples', relativePath);
    const result = checkFileExists(filepath);
    totalFiles++;
    
    if (result.exists) {
      existingFiles++;
      totalSize += result.size;
      console.log(`   ✅ ${relativePath} (${result.sizeKB}KB)`);
    } else {
      console.log(`   ❌ ${relativePath} (MISSING)`);
    }
  });
  
  // Test IRs
  console.log('\n🎚️ IMPULSE RESPONSES:');
  TEST_CONFIG.irs.forEach(filename => {
    const filepath = path.join('public/audio/irs', filename);
    const result = checkFileExists(filepath);
    totalFiles++;
    
    if (result.exists) {
      existingFiles++;
      totalSize += result.size;
      console.log(`   ✅ ${filename} (${result.sizeKB}KB)`);
    } else {
      console.log(`   ❌ ${filename} (MISSING)`);
    }
  });
  
  // Summary
  const totalSizeMB = Math.round(totalSize / (1024 * 1024));
  const completionRate = Math.round((existingFiles / totalFiles) * 100);
  
  console.log('\n📊 SUMMARY:');
  console.log(`   Files found: ${existingFiles}/${totalFiles} (${completionRate}%)`);
  console.log(`   Total size: ${totalSizeMB}MB`);
  
  if (completionRate === 100) {
    console.log('\n🎉 ALL INSTRUMENTS READY!');
    console.log('   The engine should now use real instruments.');
  } else if (completionRate > 50) {
    console.log('\n⚠️  PARTIAL INSTRUMENTS:');
    console.log('   Some instruments are missing. The engine will use fallbacks.');
  } else {
    console.log('\n❌ MOSTLY MISSING:');
    console.log('   Most instruments are missing. The engine will use synthesis.');
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (completionRate < 100) {
    console.log('1. Run: node scripts/download-instruments.js');
    console.log('2. Or follow manual instructions: node scripts/download-instruments.js --instructions');
    console.log('3. Re-run this test after downloading');
  } else {
    console.log('1. Test the engine with different genres');
    console.log('2. Verify audio quality and performance');
    console.log('3. Consider adding more instruments for variety');
  }
}

// Quality check function
function checkFileQuality() {
  console.log('🔍 FILE QUALITY CHECK\n');
  
  const qualityIssues = [];
  
  // Check for suspiciously small files (likely placeholders)
  function checkFileQuality(filepath, expectedMinSizeKB = 10) {
    const result = checkFileExists(filepath);
    if (result.exists && result.sizeKB < expectedMinSizeKB) {
      qualityIssues.push(`${filepath} (${result.sizeKB}KB) - Suspiciously small`);
    }
  }
  
  // Check SoundFonts
  TEST_CONFIG.soundfonts.forEach(filename => {
    checkFileQuality(path.join('public/audio/soundfonts', filename), 100);
  });
  
  // Check drum samples
  TEST_CONFIG.drumKits.forEach(kitName => {
    ['kick.wav', 'snare.wav', 'hat.wav'].forEach(filename => {
      checkFileQuality(path.join('public/audio/samples/drums', kitName, filename), 5);
    });
  });
  
  if (qualityIssues.length > 0) {
    console.log('⚠️  QUALITY ISSUES FOUND:');
    qualityIssues.forEach(issue => console.log(`   ${issue}`));
    console.log('\n💡 These files may be placeholders. Consider downloading real instruments.');
  } else {
    console.log('✅ All files appear to be proper instrument samples.');
  }
}

// Run tests
if (process.argv.includes('--quality')) {
  checkFileQuality();
} else {
  testInstruments();
}
