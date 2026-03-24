import fs from 'fs';
const c = fs.readFileSync('src/App.jsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l,i) => { if(l.includes('resetForm')||l.includes('clearSession')||l.includes('setGateUser')) console.log(`${i+1}: ${l.trim().substring(0,120)}`); });
