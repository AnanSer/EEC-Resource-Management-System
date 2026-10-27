const fs = require('fs');
function write(p, c) { fs.writeFileSync(p, c, 'utf8'); console.log('Created:', p); }
module.exports = { write };
