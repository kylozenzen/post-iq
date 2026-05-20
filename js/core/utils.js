import { SNAP_ADJECTIVES, SNAP_NOUNS } from './constants.js';

export const qs = id => document.getElementById(id);
export const on = (id, evt, handler, opts) => { const el = qs(id); if (!el) return null; el.addEventListener(evt, handler, opts); return el; };
export const fmtDate = d => d.toISOString().slice(0, 10);
export const monthLabel = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
export const safeText = v => String(v || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
export const compact = (v, max = 80) => { const t = String(v || '').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const toBase64Url = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
export const fromBase64Url = str => {
  const normalized = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
};
export function generateSnapshotId() { return `${pick(SNAP_ADJECTIVES)}-${pick(SNAP_NOUNS)}-${Math.random().toString(36).slice(2, 6)}`; }
export function formatDateTime(value) {
  if (!value) return 'Unscheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function formatDateOnly(value) {
  const d = new Date(value + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
export function formatDateWithYear(date) {
  const d = date instanceof Date ? date : new Date(String(date) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return String(date || 'this date');
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
export const normTags = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : String(v || '').split(',').map(x => x.trim()).filter(Boolean);
export const isVideo = url => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(String(url || ''));
export const isImageUrl = url => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(String(url || ''));
export const normalizeHexColor = color => /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color) : '#6366f1';
export const rgbaFromHex = (hex, alpha = 0.1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const num = /^[0-9a-f]{6}$/i.test(full) ? parseInt(full, 16) : 0x6366f1;
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
};
export const maskToken = t => !t ? '—' : t.length <= 8 ? '••••' : `${t.slice(0,4)}••••${t.slice(-4)}`;
