// Simple syntax checker
const fs = require('fs');

try {
    const code = fs.readFileSync('app.js', 'utf8');
    new Function(code);
    console.log('✓ app.js syntax is valid');
} catch (e) {
    console.error('✗ Syntax error in app.js:');
    console.error(e.message);
    console.error('Line:', e.lineNumber || 'unknown');
}
