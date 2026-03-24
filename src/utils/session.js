const PK = "sattva-pin";
const SESSION_KEY = "sattva-verified-user";
const SESSION_DAYS = 30;

export function saveSession(user){try{localStorage.setItem(SESSION_KEY,JSON.stringify({user,expiry:Date.now()+SESSION_DAYS*24*60*60*1000}));}catch{}}
export function loadSession(){try{const s=localStorage.getItem(SESSION_KEY);if(!s)return null;const{user,expiry}=JSON.parse(s);if(Date.now()>expiry){localStorage.removeItem(SESSION_KEY);return null;}return user;}catch{return null;}}
export function clearSession(){try{localStorage.removeItem(SESSION_KEY);}catch{}}
export async function lp(){try{return localStorage.getItem(PK);}catch{return null;}}
export async function sp(p){try{localStorage.setItem(PK,p);}catch{}}
