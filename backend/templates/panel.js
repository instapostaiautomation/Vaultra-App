/* Shared helpers for Vaultra web panels */
const API = '/api';
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n, d = 2) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: d });
const inr0 = (n) => inr(n, 0);
const g4 = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 }) + 'g';
const initials = (s) => String(s || '?').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';
const phoneFmt = (p) => { p = String(p || ''); return p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p; };
const dt = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const dOnly = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

function makeApi(tokenKey) {
  return async function api(path, opts = {}) {
    const h = { 'Content-Type': 'application/json' };
    const t = localStorage.getItem(tokenKey);
    if (t) h.Authorization = 'Bearer ' + t;
    const r = await fetch(API + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      let msg = d.detail;
      if (Array.isArray(msg)) msg = msg.map((e) => { const f = (e.loc || []).slice(-1)[0]; const n = String(f || '').replace(/_/g, ' '); return (n ? n[0].toUpperCase() + n.slice(1) + ': ' : '') + String(e.msg || '').replace(/^Value error, /, ''); }).join(' · ');
      const err = new Error(msg || 'Something went wrong');
      err.status = r.status;
      throw err;
    }
    return d;
  };
}

function toast(msg, isErr) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const ICON = {
  dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  commission: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  kyc: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/>',
  redeem: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  catalogue: '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6M2 9h20"/>',
  gifts: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>',
  referral: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  users: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  usersOff: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0M3 3l18 18"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.5 2.5 0 0 1 9.5 15M12 6v1.5M12 16.5V18"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  store: '<path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  pool: '<path d="M12 2 3 7v6c0 5 3.8 8.5 9 9 5.2-.5 9-4 9-9V7z"/>',
  invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  rate: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  log: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24">${ICON[k] || ''}</svg>`;

const statusBadge = (s) => {
  const m = { completed: 'green', collected: 'green', approved: 'green', active: 'green', pending: 'amber', processing: 'amber', failed: 'red', rejected: 'red', reversed: 'red', suspended: 'red', not_submitted: 'plain' };
  const label = s === 'not_submitted' ? 'Not submitted' : s;
  return `<span class="badge ${m[s] || ''}">${esc(label)}</span>`;
};
const metalTag = (m) => `<span class="metal ${m === 'silver' ? 'silver' : ''}"><i></i>${m === 'silver' ? 'Silver' : 'Gold'}</span>`;

function rateChip(price) {
  if (!price) return '';
  const live = price.live;
  return `<div class="ratechip" id="ratechip"><span class="dot ${live ? 'live' : ''}"></span>
    <span>Gold <b class="num">${inr(price.base_rate)}</b>/g</span><span class="sep"></span>
    <span>Silver <b class="num">${inr(price.silver?.base_rate)}</b>/g</span>
    <span class="sep"></span><span style="color:var(--mute)">${live ? 'Live' : 'Indicative'}</span></div>`;
}

function barChart(series, valueKey, fmt) {
  if (!series || !series.length) return '<div class="chart-empty">No bookings in this period</div>';
  const max = Math.max(...series.map((s) => s[valueKey] || 0), 1);
  const show = series.slice(-31);
  return `<div class="chart">${show.map((s) => {
    const h = Math.max(2, Math.round(((s[valueKey] || 0) / max) * 140));
    const d = new Date(s.day + 'T00:00:00');
    return `<div class="bar"><i style="height:${h}px" data-t="${esc(fmt(s[valueKey]))}"></i><span>${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}</span></div>`;
  }).join('')}</div>`;
}

function rangeBar(state, onChange) {
  const opts = [['1d', 'Today'], ['3d', '3 Days'], ['7d', '7 Days'], ['30d', '30 Days'], ['custom', 'Custom']];
  window.__rangeChange = onChange;
  return `<div class="toolbar">
    <div class="seg">${opts.map(([k, l]) => `<button class="${state.range === k ? 'on' : ''}" onclick="__rangeChange('${k}')">${l}</button>`).join('')}</div>
    ${state.range === 'custom' ? `<input type="date" class="input" id="r_from" value="${state.from || ''}" max="${todayISO()}">
      <span style="color:var(--mute)">to</span><input type="date" class="input" id="r_to" value="${state.to || todayISO()}" max="${todayISO()}">
      <button class="btn primary" onclick="__rangeChange('custom', true)">Apply</button>` : ''}
  </div>`;
}

function openModal(html, wide) {
  closeModal();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.id = 'modal';
  o.innerHTML = `<div class="modal" style="${wide ? 'max-width:640px' : ''}">${html}</div>`;
  o.addEventListener('click', (e) => { if (e.target === o) closeModal(); });
  document.body.appendChild(o);
}
function closeModal() { $('#modal')?.remove(); }
function openDrawer(html) {
  closeDrawer();
  const o = document.createElement('div');
  o.className = 'drawer-wrap';
  o.id = 'drawer';
  o.innerHTML = `<div class="drawer">${html}</div>`;
  o.addEventListener('click', (e) => { if (e.target === o) closeDrawer(); });
  document.body.appendChild(o);
}
function closeDrawer() { $('#drawer')?.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });

function copyText(t) {
  navigator.clipboard?.writeText(t).then(() => toast('Copied'), () => toast('Copy failed', true));
}
