const HISTORY_KEY = 'recycleiq-history-v1';
const PREFS_KEY = 'recycleiq-prefs-v1';
const SCORE_KEY = 'recycleiq-score-v1';

export function getHistory(){ try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
export function saveHistory(history){ localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); }
export function addHistory(item){ const history = getHistory(); history.unshift({ ...item, id: crypto.randomUUID?.() || String(Date.now()), date: new Date().toISOString() }); saveHistory(history); return history; }
export function clearHistory(){ localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(SCORE_KEY); }
export function getPrefs(){ try { return { theme:'system', textSize:'normal', language:'en', ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')) }; } catch { return { theme:'system', textSize:'normal', language:'en' }; } }
export function savePrefs(prefs){ localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
export function getScore(){ try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '{"base":0,"quiz":0}'); } catch { return {base:0,quiz:0}; } }
export function saveScore(score){ localStorage.setItem(SCORE_KEY, JSON.stringify(score)); }
export function calculateScore(){ const history = getHistory(); const score = getScore(); const recyclable = history.filter(item => item.status === 'Recyclable').length; return Math.min(100, Math.round(Math.min(50, history.length * 5) + Math.min(35, recyclable * 4) + Math.min(15, score.quiz || 0))); }
export function getStreak(){ const dates = [...new Set(getHistory().map(item => item.date.slice(0,10)))].sort().reverse(); if(!dates.length) return 0; let streak=1; let cursor=new Date(`${dates[0]}T12:00:00`); for(let i=1;i<dates.length;i++){ const next=new Date(cursor); next.setDate(cursor.getDate()-1); if(dates[i]===next.toISOString().slice(0,10)){ streak++; cursor=next; } else break; } return streak; }
export function getWeeklyCounts(){ const counts = Array(7).fill(0); const now = new Date(); const day = (now.getDay()+6)%7; getHistory().forEach(item=>{ const d = new Date(item.date); const diff = Math.round((new Date(now.toDateString())-new Date(d.toDateString()))/86400000); const index = day-diff; if(index>=0 && index<7) counts[index]++; }); return counts; }
