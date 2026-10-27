const fs = require('fs');
const [,, targetFile, b64File] = process.argv;
const b64 = fs.readFileSync(b64File, 'utf8').trim();
fs.writeFileSync(targetFile, Buffer.from(b64, 'base64').toString('utf8'), 'utf8');
console.log('Successfully wrote:', targetFile);