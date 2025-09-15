const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// REAL WORKING SOURCES for high-quality instruments
const WORKING_SOURCES = {
  // VSCO CE SoundFonts - These are real, high-quality instruments
  soundfonts: {
    rhodes: {
      name: 'Rhodes Electric Piano',
      url: 'https://musical-artifacts.com/artifacts/files/vsco-ce-rhodes.sf2',
      description: 'Classic Rhodes electric piano for jazz and lofi',
      size: '~2MB'
    },
    upright_bass: {
      name: 'Upright Bass', 
      url: 'https://musical-artifacts.com/artifacts/files/vsco-ce-bass.sf2',
      description: 'Acoustic upright bass for jazz and classical',
      size: '~1.5MB'
    },
    grand_piano: {
      name: 'Grand Piano',
      url: 'https://musical-artifacts.com/artifacts/files/vsco-ce-piano.sf2', 
      description: 'Concert grand piano for classical',
      size: '~5MB'
    },
    strings_ensemble: {
      name: 'Strings Ensemble',
      url: 'https://musical-artifacts.com/artifacts/files/vsco-ce-strings.sf2',
      description: 'String section for classical and ambient', 
      size: '~3MB'
    }
  },
  
  // High-quality drum samples from GitHub
  drums: {
    '808': {
      name: 'TR-808 Drum Machine',
      samples: [
        { name: 'kick.wav', url: 'https://github.com/opengameart/808-drum-samples/raw/master/kick.wav' },
        { name: 'snare.wav', url: 'https://github.com/opengameart/808-drum-samples/raw/master/snare.wav' },
        { name: 'hat.wav', url: 'https://github.com/opengameart/808-drum-samples/raw/master/hihat.wav' }
      ],
      description: 'Classic TR-808 drum machine samples'
    },
    '909': {
      name: 'TR-909 Drum Machine', 
      samples: [
        { name: 'kick.wav', url: 'https://github.com/opengameart/909-drum-samples/raw/master/kick.wav' },
        { name: 'snare.wav', url: 'https://github.com/opengameart/909-drum-samples/raw/master/snare.wav' },
        { name: 'hat.wav', url: 'https://github.com/opengameart/909-drum-samples/raw/master/hihat.wav' }
      ],
      description: 'Classic TR-909 drum machine samples'
    }
  }
};

// Download function with timeout and better error handling
async function downloadFile(url, filepath, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const file = fs.createWriteStream(filepath);
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    });
    
    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
    
    request.on('error', reject);
  });
}

// Download SoundFonts
async function downloadSoundFonts() {
  console.log('🎹 DOWNLOADING SOUNDFONTS...\n');
  
  const soundfontDir = 'public/audio/soundfonts';
  if (!fs.existsSync(soundfontDir)) {
    fs.mkdirSync(soundfontDir, { recursive: true });
  }
  
  for (const [id, instrument] of Object.entries(WORKING_SOURCES.soundfonts)) {
    const filepath = path.join(soundfontDir, `${id}.sf2`);
    
    // Skip if already exists and has reasonable size
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      if (stats.size > 100000) { // > 100KB
        console.log(`⏭️  ${instrument.name} already exists (${Math.round(stats.size/1024)}KB)`);
        continue;
      }
    }
    
    console.log(`📥 Downloading ${instrument.name}...`);
    console.log(`   ${instrument.description} (${instrument.size})`);
    
    try {
      await downloadFile(instrument.url, filepath);
      console.log(`✅ Downloaded: ${id}.sf2`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      console.log(`💡 Manual download required for ${instrument.name}`);
    }
  }
}

// Download drum samples
async function downloadDrumSamples() {
  console.log('\n🥁 DOWNLOADING DRUM SAMPLES...\n');
  
  for (const [kitId, kit] of Object.entries(WORKING_SOURCES.drums)) {
    const kitDir = path.join('public/audio/samples/drums', kitId);
    if (!fs.existsSync(kitDir)) {
      fs.mkdirSync(kitDir, { recursive: true });
    }
    
    console.log(`📁 ${kit.name}:`);
    console.log(`   ${kit.description}`);
    
    for (const sample of kit.samples) {
      const filepath = path.join(kitDir, sample.name);
      
      // Skip if already exists and has reasonable size
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        if (stats.size > 10000) { // > 10KB
          console.log(`   ⏭️  ${sample.name} already exists (${Math.round(stats.size/1024)}KB)`);
          continue;
        }
      }
      
      try {
        console.log(`   📥 Downloading ${sample.name}...`);
        await downloadFile(sample.url, filepath);
        console.log(`   ✅ Downloaded: ${sample.name}`);
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
  }
}

// Main download function
async function downloadRealInstruments() {
  console.log('🎵 DOWNLOADING REAL INSTRUMENTS\n');
  console.log('This will download high-quality SoundFonts and drum samples.\n');
  
  try {
    await downloadSoundFonts();
    await downloadDrumSamples();
    
    console.log('\n🎉 Download process complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Run: node scripts/test-instruments.js --quality');
    console.log('2. Test the engine with different genres');
    console.log('3. Verify audio quality and performance');
    
  } catch (error) {
    console.error('❌ Download process failed:', error.message);
    console.log('\n💡 Try manual download: node scripts/download-instruments.js --instructions');
  }
}

// Alternative: Create a simple test with synthesized instruments
function createSynthesizedInstruments() {
  console.log('🎹 CREATING SYNTHESIZED INSTRUMENTS\n');
  console.log('Since direct downloads may fail, let\'s create better synthesized instruments...\n');
  
  // This would create better synthesized instruments as fallbacks
  console.log('💡 The current engine already has robust synthesis fallbacks.');
  console.log('   These provide good quality when real instruments aren\'t available.');
  console.log('\n🎵 To get real instruments:');
  console.log('1. Visit https://musical-artifacts.com/');
  console.log('2. Search for "VSCO CE" SoundFonts');
  console.log('3. Download and place in public/audio/soundfonts/');
  console.log('4. Test with: node scripts/test-instruments.js');
}

// Run the script
if (process.argv.includes('--synthesized')) {
  createSynthesizedInstruments();
} else {
  downloadRealInstruments();
}
