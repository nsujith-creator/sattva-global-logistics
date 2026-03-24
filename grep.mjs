import fs from 'fs';
const c = fs.readFileSync('src/App.jsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l,i) => {
  if(l.includes('Route & Cargo')||l.includes('st.sec')||i>=269&&i<=275)
    console.log(`${i+1}: ${l.trim().substring(0,130)}`);
});
