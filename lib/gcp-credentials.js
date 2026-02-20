/**
 * Render-compatible GCP credentials loader.
 * If GOOGLE_SERVICE_ACCOUNT_JSON is set (e.g. on Render), write it to a temp file
 * and set GOOGLE_APPLICATION_CREDENTIALS so ADC and @google-cloud/* clients work.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

let _didLoad = false;

function loadGcpCredentials() {
  if (_didLoad) return;
  _didLoad = true;
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json || typeof json !== 'string') return;
  try {
    JSON.parse(json);
  } catch (e) {
    console.warn('[GCP] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON; skipping credentials file.');
    return;
  }
  const tmpDir = os.tmpdir();
  const credPath = path.join(tmpDir, 'gcp-sa.json');
  try {
    fs.writeFileSync(credPath, json, 'utf8');
    fs.chmodSync(credPath, 0o600);
  } catch (e) {
    console.warn('[GCP] Failed to write credentials file:', e.message);
    return;
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    console.log('[GCP] Set GOOGLE_APPLICATION_CREDENTIALS from GOOGLE_SERVICE_ACCOUNT_JSON');
  }
}

module.exports = { loadGcpCredentials };
