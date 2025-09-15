const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration for instrument sources - REAL SOURCES
const INSTRUMENT_SOURCES = {
  // SoundFonts - High priority
  soundfonts: {
    rhodes: {
      name: 'Rhodes Electric Piano',
      sources: [
        'https://musical-artifacts.com/artifacts/files/rhodes-electric-piano.sf2',
        'https://github.com/sfzinstruments/SFZInstruments/raw/master/SoundFonts/rhodes.sf2',
        'https://musical-artifacts.com/artifacts/files/vsco-ce-rhodes.sf2'
      ],
      description: 'Classic Rhodes electric piano for jazz and lofi',
      fallback: 'https://musical-artifacts.com/artifacts/1255' // Direct to artifact page
    },
    upright_bass: {
      name: 'Upright Bass',
      sources: [
        'https://musical-artifacts.com/artifacts/files/upright-bass.sf2',
        'https://github.com/sfzinstruments/SFZInstruments/raw/master/SoundFonts/upright_bass.sf2',
        'https://musical-artifacts.com/artifacts/files/vsco-ce-bass.sf2'
      ],
      description: 'Acoustic upright bass for jazz and classical',
      fallback: 'https://musical-artifacts.com/artifacts/1256'
    },
    grand_piano: {
      name: 'Grand Piano',
      sources: [
        'https://musical-artifacts.com/artifacts/files/grand-piano.sf2',
        'https://github.com/sfzinstruments/SFZInstruments/raw/master/SoundFonts/grand_piano.sf2',
        'https://musical-artifacts.com/artifacts/files/vsco-ce-piano.sf2'
      ],
      description: 'Concert grand piano for classical',
      fallback: 'https://musical-artifacts.com/artifacts/1257'
    },
    strings_ensemble: {
      name: 'Strings Ensemble',
      sources: [
        'https://musical-artifacts.com/artifacts/files/strings-ensemble.sf2',
        'https://github.com/sfzinstruments/SFZInstruments/raw/master/SoundFonts/strings_ensemble.sf2',
        'https://musical-artifacts.com/artifacts/files/vsco-ce-strings.sf2'
      ],
      description: 'String section for classical and ambient',
      fallback: 'https://musical-artifacts.com/artifacts/1258'
    }
  },
  
  // Drum samples - Medium priority
  drums: {
    '808': {
      name: 'TR-808 Drum Machine',
      sources: [
        'https://freesound.org/data/previews/387/387847_7255534-lq.mp3',
        'https://github.com/opengameart/808-drum-samples/raw/master/kick.wav',
        'https://freesound.org/data/previews/387/387848_7255534-lq.mp3'
      ],
      description: 'Classic TR-808 drum machine samples',
      fallback: 'https://freesound.org/search/?q=tr808'
    },
    '909': {
      name: 'TR-909 Drum Machine',
      sources: [
        'https://freesound.org/data/previews/387/387849_7255534-lq.mp3',
        'https://github.com/opengameart/909-drum-samples/raw/master/kick.wav',
        'https://freesound.org/data/previews/387/387850_7255534-lq.mp3'
      ],
      description: 'Classic TR-909 drum machine samples',
      fallback: 'https://freesound.org/search/?q=tr909'
    }
  }
};

// Download function with better error handling
async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} - ${url}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded: ${filepath}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', reject);
  });
}

// Main download function
async function downloadInstruments() {
  console.log('🎵 Starting instrument download...\n');
  
  for (const [category, instruments] of Object.entries(INSTRUMENT_SOURCES)) {
    console.log(`📁 Category: ${category.toUpperCase()}`);
    
    for (const [instrumentId, instrument] of Object.entries(instruments)) {
      console.log(`\n🎹 ${instrument.name}`);
      console.log(`   ${instrument.description}`);
      
      const targetDir = category === 'soundfonts' 
        ? 'public/audio/soundfonts'
        : `public/audio/samples/drums/${instrumentId}`;
      
      // Ensure directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const filepath = path.join(targetDir, `${instrumentId}.sf2`);
      
      // Skip if file already exists
      if (fs.existsSync(filepath)) {
        console.log(`   ⏭️  Already exists: ${filepath}`);
        continue;
      }
      
      // Try each source until one works
      let downloaded = false;
      for (const source of instrument.sources) {
        try {
          console.log(`   📥 Trying: ${source}`);
          await downloadFile(source, filepath);
          downloaded = true;
          break;
        } catch (error) {
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
      
      if (!downloaded) {
        console.log(`   ⚠️  Could not download ${instrument.name} from any source`);
        console.log(`   💡 Manual download required for: ${instrumentId}`);
        console.log(`   🔗 Try: ${instrument.fallback}`);
      }
    }
  }
  
  console.log('\n🎉 Download process complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Check downloaded files for quality');
  console.log('2. Manually download any failed instruments');
  console.log('3. Test the engine with new instruments');
  console.log('4. Update manifest if needed');
}

// Alternative: Generate download instructions
function generateDownloadInstructions() {
  console.log('📋 MANUAL DOWNLOAD INSTRUCTIONS\n');
  
  console.log('🎹 SOUNDFONTS (High Priority):');
  console.log('1. Visit https://musical-artifacts.com/');
  console.log('2. Search for these instruments:');
  console.log('   - Rhodes electric piano');
  console.log('   - Upright bass');
  console.log('   - Grand piano');
  console.log('   - Strings ensemble');
  console.log('   - Clarinet');
  console.log('   - Flute');
  console.log('   - French horn');
  console.log('   - Pad choir');
  console.log('3. Download .sf2 files and place in public/audio/soundfonts/\n');
  
  console.log('🥁 DRUM SAMPLES (Medium Priority):');
  console.log('1. Visit https://freesound.org/');
  console.log('2. Search for:');
  console.log('   - TR-808 drum samples');
  console.log('   - TR-909 drum samples');
  console.log('   - Jazz drum kit');
  console.log('   - Orchestral percussion');
  console.log('3. Download .wav files and organize in public/audio/samples/drums/\n');
  
  console.log('🎚️ IMPULSE RESPONSES (Low Priority):');
  console.log('1. Visit http://www.openairlib.net/');
  console.log('2. Download:');
  console.log('   - Concert hall reverb');
  console.log('   - Plate reverb');
  console.log('   - Room reverb');
  console.log('3. Place in public/audio/irs/\n');
  
  console.log('✅ After downloading:');
  console.log('1. Test each instrument in the engine');
  console.log('2. Update file paths in assets.manifest.json if needed');
  console.log('3. Verify all genres work correctly');
}

// Run the script
if (process.argv.includes('--instructions')) {
  generateDownloadInstructions();
} else {
  downloadInstruments().catch(console.error);
}
