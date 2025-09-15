const fs = require('fs');
const path = require('path');

// Basic sample generation script
// This creates simple sine wave samples for testing

const frequencies = {
  'C3': 130.81,
  'C#3': 138.59,
  'D3': 146.83,
  'D#3': 155.56,
  'E3': 164.81,
  'F3': 174.61,
  'F#3': 185.00,
  'G3': 196.00,
  'G#3': 207.65,
  'A3': 220.00,
  'A#3': 233.08,
  'B3': 246.94,
  'C4': 261.63,
  'C#4': 277.18,
  'D4': 293.66,
  'D#4': 311.13,
  'E4': 329.63,
  'F4': 349.23,
  'F#4': 369.99,
  'G4': 392.00,
  'G#4': 415.30,
  'A4': 440.00,
  'A#4': 466.16,
  'B4': 493.88,
  'C5': 523.25,
  'C#5': 554.37,
  'D5': 587.33,
  'D#5': 622.25,
  'E5': 659.25,
  'F5': 698.46,
  'F#5': 739.99,
  'G5': 783.99,
  'G#5': 830.61,
  'A5': 880.00,
  'A#5': 932.33,
  'B5': 987.77,
  'C6': 1046.50
};

// Create a simple WAV file header
function createWavHeader(sampleRate, channels, bitsPerSample, dataLength) {
  const buffer = Buffer.alloc(44);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // byte rate
  buffer.writeUInt16LE(channels * bitsPerSample / 8, 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  
  return buffer;
}

// Generate a simple sine wave
function generateSineWave(frequency, duration, sampleRate = 44100) {
  const samples = Math.floor(duration * sampleRate);
  const data = Buffer.alloc(samples * 2); // 16-bit samples
  
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const value = Math.floor(sample * 32767); // Convert to 16-bit
    data.writeInt16LE(value, i * 2);
  }
  
  return data;
}

// Create a WAV file
function createWavFile(frequency, duration, filename) {
  const sampleRate = 44100;
  const channels = 1;
  const bitsPerSample = 16;
  
  const audioData = generateSineWave(frequency, duration, sampleRate);
  const header = createWavHeader(sampleRate, channels, bitsPerSample, audioData.length);
  
  const fullPath = path.join(__dirname, '..', filename);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const file = fs.createWriteStream(fullPath);
  file.write(header);
  file.write(audioData);
  file.end();
  
  console.log(`Created: ${filename}`);
}

// Generate piano samples
console.log('Generating piano samples...');
Object.entries(frequencies).forEach(([note, freq]) => {
  createWavFile(freq, 2.0, `public/audio/samples/keys/piano/${note}.wav`);
});

// Generate violin samples (C4-C6 range)
console.log('Generating violin samples...');
Object.entries(frequencies).forEach(([note, freq]) => {
  if (note >= 'C4' && note <= 'C6') {
    createWavFile(freq, 2.0, `public/audio/samples/strings/violin/${note}.wav`);
  }
});

// Generate sax samples (C4-C6 range)
console.log('Generating sax samples...');
Object.entries(frequencies).forEach(([note, freq]) => {
  if (note >= 'C4' && note <= 'C6') {
    createWavFile(freq, 2.0, `public/audio/samples/winds/sax/tenor/${note}.wav`);
  }
});

// Generate drum samples
console.log('Generating drum samples...');
const drumFrequencies = {
  'kick': 60,    // Low frequency for kick
  'snare': 200,  // Mid frequency for snare
  'hihat': 800,  // High frequency for hihat
  'ride': 1000   // High frequency for ride
};

Object.entries(drumFrequencies).forEach(([drum, freq]) => {
  createWavFile(freq, 0.5, `public/audio/samples/drums/jazz/${drum}.wav`);
  createWavFile(freq, 0.5, `public/audio/samples/drums/house/${drum}.wav`);
  createWavFile(freq, 0.5, `public/audio/samples/drums/lofi/${drum}.wav`);
});

console.log('Sample generation complete!');
