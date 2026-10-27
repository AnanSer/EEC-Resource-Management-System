const fs = require('fs');
const path = require('path');

function writeFile(file, content) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('[OK] Created:', file);
}

function run() {
  const base = 'C:/Users/user/Desktop/React projects/EEC-Resource-Management-System/frontend/src';
  const manifestPath = process.argv[2];
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error('No manifest provided');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const item of manifest) {
    const target = path.join(base, item.relPath);
    const decoded = Buffer.from(item.b64, 'base64').toString('utf8');
    writeFile(target, decoded);
  }
  console.log('All manifest files written successfully!');
}

run();
