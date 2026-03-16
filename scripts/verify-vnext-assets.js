const fs = require('fs');
const path = require('path');

function main() {
  const root = process.cwd();
  const tonePath = path.resolve(root, 'vnext/text/tones/daily.personality.v1.json');

  if (fs.existsSync(tonePath)) {
    console.log('[VERIFY_VNEXT_ASSETS] OK daily tone spec found at', tonePath);
    process.exit(0);
  } else {
    console.error('[TEXT_TONE_MISSING] vnext/text/tones/daily.personality.v1.json not found at', tonePath);
    process.exit(1);
  }
}

main();

