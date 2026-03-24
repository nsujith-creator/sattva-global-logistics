import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'src');

// Characters to fix: UTF-8 mojibake sequences
const replacements = [
  // em dash â€" → —
  [/â€"/g, '—'],
  // right single quote â€™ → '
  [/â€™/g, '\u2019'],
  // left single quote â€˜ → '
  [/â€˜/g, '\u2018'],
  // right double quote â€ → "
  [/â€œ/g, '\u201C'],
  [/â€\u009d/g, '\u201D'],
  // registered trademark Â® → ®
  [/Â®/g, '®'],
  // non-breaking space Â → 
  [/Â /g, '\u00A0'],
  // flag emojis ðŸ‡®ðŸ‡³ → 🇮🇳
  [/ðŸ‡®ðŸ‡³/g, '🇮🇳'],
  // ellipsis â€¦ → …
  [/â€¦/g, '…'],
  // bullet â€¢ → •
  [/â€¢/g, '•'],
  // arrow â†' → →
  [/â†'/g, '→'],
  // checkmark âœ" → ✓
  [/âœ"/g, '✓'],
  // any remaining Ã sequences
  [/Ã©/g, 'é'],
  [/Ã /g, 'à'],
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of replacements) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) { changed = true; content = newContent; }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', filePath.replace(__dirname, ''));
  }
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      walkDir(full);
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      fixFile(full);
    }
  }
}

walkDir(srcDir);
console.log('Done.');
