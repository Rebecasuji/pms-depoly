const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'routes.ts');
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// GET MY TICKETS') && startIdx === -1) {
    startIdx = i;
  }
  if (lines[i].includes('app.get("/api/tickets/export"') && endIdx === -1) {
    endIdx = i;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx)];
  fs.writeFileSync(filepath, newLines.join('\n'));
  console.log(`Pruned lines from ${startIdx} to ${endIdx}`);
} else {
  console.log(`Could not find indices: start=${startIdx}, end=${endIdx}`);
}
