const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const dirs = [
  'public/audio/soundfonts',
  'public/audio/samples/drums/808',
  'public/audio/samples/drums/909',
  'public/audio/samples/drums/jazz',
  'public/audio/samples/drums/orch',
  'public/audio/samples/pads',
  'public/audio/samples/bells',
  'public/audio/samples/bass',
  'public/audio/samples/keys',
  'public/audio/samples/strings',
  'public/audio/samples/winds',
  'public/audio/samples/lofi',
  'public/audio/irs'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Create a simple placeholder audio file (1 second of silence)
function createPlaceholderWav(filename) {
  // Simple WAV header for 1 second of silence at 44.1kHz
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = sampleRate * numChannels * bitsPerSample / 8;
  const fileSize = 36 + dataSize;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Fill with silence (zeros)
  buffer.fill(0, 44);
  
  fs.writeFileSync(filename, buffer);
  console.log(`Created placeholder: ${filename}`);
}

// Create placeholder files for all instruments
const placeholders = [
  // SoundFonts
  'public/audio/soundfonts/rhodes.sf2',
  'public/audio/soundfonts/upright_bass.sf2',
  'public/audio/soundfonts/grand_piano.sf2',
  'public/audio/soundfonts/strings_ensemble.sf2',
  'public/audio/soundfonts/clarinet.sf2',
  'public/audio/soundfonts/flute.sf2',
  'public/audio/soundfonts/french_horn.sf2',
  'public/audio/soundfonts/pad_choir.sf2',
  
  // Drum samples
  'public/audio/samples/drums/808/kick.wav',
  'public/audio/samples/drums/808/snare.wav',
  'public/audio/samples/drums/808/hat.wav',
  'public/audio/samples/drums/909/kick.wav',
  'public/audio/samples/drums/909/snare.wav',
  'public/audio/samples/drums/909/hat.wav',
  'public/audio/samples/drums/jazz/kick.wav',
  'public/audio/samples/drums/jazz/snare.wav',
  'public/audio/samples/drums/jazz/hat.wav',
  'public/audio/samples/drums/orch/kick.wav',
  'public/audio/samples/drums/orch/snare.wav',
  'public/audio/samples/drums/orch/hat.wav',
  
  // Other samples
  'public/audio/samples/pads/shimmer.wav',
  'public/audio/samples/bells/mallet_c4.wav',
  'public/audio/samples/lofi/vinyl_loop.wav',
  
  // Impulse responses
  'public/audio/irs/hall.wav',
  'public/audio/irs/plate.wav',
  'public/audio/irs/room.wav'
];

placeholders.forEach(file => {
  if (!fs.existsSync(file)) {
    createPlaceholderWav(file);
  }
});

console.log('\n✅ Audio asset placeholders created!');
console.log('Note: These are silent placeholder files.');
console.log('Replace them with real audio files for actual instrument sounds.');
