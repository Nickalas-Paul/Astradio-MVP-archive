#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('❌ index.html not found at:', htmlPath);
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Add audition script imports before closing </body>
const auditionScripts = `
  <!-- Teacher Audition System -->
  <script src="audition/contracts.js"></script>
  <script src="audition/scaler.js"></script>
  <script src="audition/feature-encoder.js"></script>
  <script src="audition/teacher.js"></script>
  <script src="audition/generator.js"></script>
  <script src="audition/quality-gates.js"></script>
  <script src="audition/audition-runner.js"></script>
  <script src="audition/render-client.js"></script>
  <script src="audition/telemetry.js"></script>
  <script src="audition/integration.js"></script>`;

// Insert before closing </body> tag
const bodyEndIndex = html.lastIndexOf('</body>');
if (bodyEndIndex === -1) {
  console.error('❌ No </body> tag found in index.html');
  process.exit(1);
}

html = html.slice(0, bodyEndIndex) + auditionScripts + '\n' + html.slice(bodyEndIndex);

fs.writeFileSync(htmlPath, html);

console.log('✅ Added audition scripts to index.html');
console.log('📝 Added scripts:', auditionScripts.split('\n').filter(line => line.includes('script')).length);
