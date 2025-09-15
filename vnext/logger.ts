// vnext/logger.ts
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, '../../../logs');
const LOG_FILE = path.join(LOG_DIR, 'vnext-audit.jsonl');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function logAudit(entry: any) {
  const timestamp = new Date().toISOString();
  const logLine = JSON.stringify({ ts: timestamp, ...entry }) + '\n';
  
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (error) {
    console.warn('Failed to write audit log:', error);
  }
}
