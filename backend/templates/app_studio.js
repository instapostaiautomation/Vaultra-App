/* Master console: App Studio — white-label app per jeweller */
S.studio = null; S.studioSel = ''; S.draft = null;
const loadStudio = () => safe(async () => {
  S.studio = await api('/master/app-studio');
  if (!S.studio.apps.some((a) => a.id === S.studioSel)) S.studioSel = S.studio.apps[0]?.id || '';
  pickDraft();
}, 'studio');
function pickDraft() {
  const a = (S.studio?.apps || []).find((x) => x.id === S.studioSel);
  S.draft = a ? { app_name: a.app_name || `${a.business_name.split(' ')[0]} Gold`, bundle_id: a.bundle_id || a.suggested_bundle_id, theme_preset: a.theme_preset || 'royal_gold',
    logo_url: a.logo_url, splash_url: a.splash_url, app_version: a.app_version, support_email: a.support_email || a.email,
    store_short: a.store_short || a.config.store.shortDescription, store_long: a.store_long || a.config.store.longDescription, store_keywords: a.store_keywords || a.config.store.keywords } : null;
}
function studioSelect(id) { S.studioSel = id; pickDraft(); render(); }
function dset(k, v, rerender) { S.draft[k] = v; if (rerender) render(); else { const pv = $('#studio-preview'); if (pv) pv.innerHTML = phone(); } }

const SECTION_LABEL = { prices: 'Live prices', karats: '24K · 22K · 18K', sip: 'Auto SIP', banners: 'Offers', buy: 'Buy gold', categories: 'Categories', trending: 'Trending', promos: 'Gift & refer' };
function phone(small) {
  const d = S.draft; const P = S.studio.presets[d.theme_preset]; const cur = S.studio.apps.find((x) => x.id === S.studioSel) || {}; const k = cur.karats || S.studio.karats || {}; const nodata = S.studio.price?.has_live === false;
  const r = P.cardRadius; const name = esc(d.app_name || 'Your app');
  const val = (v) => nodata || !v ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const logo = d.logo_url ? `<img src="${esc(d.logo_url)}" style="width:100%;height:100%;object-fit:contain">` : esc(initials(d.app_name || 'G'));
  const block = (s) => ({
    prices: `<div style="display:flex;gap:6px"><div style="flex:1;background:${P.accentColor};border-radius:${r * .6}px;padding:8px"><div style="font-size:7px;color:${P.primaryColor};letter-spacing:.5px">LIVE RATE</div><div style="font-size:10px;color:${P.primaryColor};font-weight:700">Gold 24K</div><div style="font-size:11px;color:#fff;font-weight:700">${val(k['24K'])}</div></div><div style="flex:1;background:${P.accentColor};border-radius:${r * .6}px;padding:8px"><div style="font-size:7px;color:#cbd5e1">LIVE RATE</div><div style="font-size:10px;color:#e5e7eb;font-weight:700">Silver</div><div style="font-size:11px;color:#fff;font-weight:700">${val(cur.silver_buy || S.studio.price?.silver?.buy)}</div></div></div>`,
    karats: `<div style="background:#fff;border:1px solid ${P.primaryColor}55;border-radius:${r * .6}px;padding:7px 9px;font-size:9px">${['24K', '22K', '18K'].map((x) => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:${P.secondaryColor}">${x}</span><b style="color:${P.accentColor}">${val(k[x])}</b></div>`).join('')}</div>`,
    sip: `<div style="background:${P.accentColor};border-radius:${r * .6}px;padding:8px;color:#fff;font-size:9px"><span style="color:${P.primaryColor};font-size:7px;letter-spacing:.6px">AUTO SIP</span><br><b>Save daily from ₹100</b></div>`,
    banners: `<div style="height:44px;border-radius:${r * .6}px;background:linear-gradient(120deg,${P.secondaryColor},${P.primaryColor});color:#fff;font-size:9px;padding:8px"><b>Festive offer</b><br>0% making on coins</div>`,
    buy: `<div style="background:#fff;border-radius:${r * .6}px;padding:8px;border:1px solid ${P.primaryColor}33"><div style="font-size:8px;color:#6b7280">Buy gold</div><div style="font-size:12px;font-weight:700;color:${P.accentColor}">₹ 1,000</div><div style="margin-top:5px;background:${P.primaryColor};color:#fff;border-radius:${r * .5}px;text-align:center;font-size:9px;padding:5px;font-weight:700">Proceed to Buy →</div></div>`,
    categories: `<div style="display:flex;gap:5px">${['Rings', 'Bangles', 'Chains', 'Kadas'].map((c) => `<div style="flex:1;text-align:center"><div style="height:26px;border-radius:${r * .5}px;background:${P.backgroundColor};border:1px solid ${P.primaryColor}55"></div><div style="font-size:7px;margin-top:2px;color:${P.accentColor}">${c}</div></div>`).join('')}</div>`,
    trending: `<div style="display:flex;gap:5px">${[1, 2].map(() => `<div style="flex:1;height:46px;border-radius:${r * .6}px;background:#fff;border:1px solid ${P.primaryColor}33"></div>`).join('')}</div>`,
    promos: `<div style="background:#fff;border-radius:${r * .6}px;padding:7px;font-size:9px;color:${P.accentColor};border:1px solid ${P.primaryColor}33">🎁 Gift Gold · Refer & Earn</div>`,
  }[s] || '');
  const sections = small ? P.homeLayout.slice(0, 4) : P.homeLayout;
  return `<div class="phone ${small ? 'sm' : ''}" style="background:${P.backgroundColor}">
    <div style="display:flex;align-items:center;gap:6px;padding:10px 10px 8px;background:#fff;border-bottom:1px solid ${P.primaryColor}55">
      <div style="width:22px;height:22px;border-radius:${Math.max(4, r * .35)}px;background:linear-gradient(135deg,${P.primaryColor},${P.secondaryColor});color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;overflow:hidden">${logo}</div>
      <b style="font-size:11px;color:${P.accentColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</b></div>
    <div style="display:flex;flex-direction:column;gap:7px;padding:9px">${sections.map(block).join('')}</div></div>`;
}

function stepper(a) {
  const st = S.studio.statuses; const cur = st.findIndex((s) => s.key === a.app_status);
  return `<div class="stepper">${st.map((s, i) => `<div class="step ${i < cur ? 'done' : i === cur ? 'on' : ''}"><span>${i < cur ? '✓' : i + 1}</span><b>${s.label}</b></div>`).join('')}</div>`;
}
function vStudio() {
  const head = ph('App Studio', 'Brand each shop\'s Android & iOS app from the base app, then export the App Kit for your build pipeline.');
  const s = S.studio; if (!s) return head + loading;
  if (!s.apps.length) return head + '<div class="card"><div class="empty"><b>No shops yet</b></div></div>';
  const a = s.apps.find((x) => x.id === S.studioSel); const d = S.draft;
  const label = Object.fromEntries(s.statuses.map((x) => [x.key, x.label]));
  const list = `<div class="card studio-list">${s.apps.map((x) => `<button class="studio-item ${x.id === S.studioSel ? 'on' : ''}" onclick="studioSelect('${x.id}')" data-testid="studio-shop-${x.id}">
      <div><b>${esc(x.app_name || x.business_name)}</b><div class="sub">${esc(x.business_name)}${x.city ? ' · ' + esc(x.city) : ''}</div></div>
      <span class="badge ${x.app_status === 'live' ? 'green' : x.app_status === 'details_pending' ? 'amber' : 'gold'}">${label[x.app_status]}</span></button>`).join('')}</div>`;
  const nextStatus = { config_ready: 'built', built: 'submitted', submitted: 'live' }[a.app_status];
  const themes = Object.entries(s.presets).map(([key, P]) => `<button class="theme-opt ${d.theme_preset === key ? 'on' : ''}" onclick="dset('theme_preset','${key}',true)" data-testid="theme-${key}">
      <div class="sw">${[P.primaryColor, P.secondaryColor, P.accentColor, P.backgroundColor].map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${P.label}</b><span>Radius ${P.cardRadius} · ${P.homeLayout.slice(0, 3).map((x) => SECTION_LABEL[x]).join(' → ')}</span></button>`).join('');
  return head + `<div class="studio">
    ${list}
    <div class="studio-main">
      <div class="card pad">${stepper(a)}
        <div class="studio-actions">
          <button class="btn primary" onclick="studioSave()" id="studio-save">Save app details</button>
          <button class="btn gold" onclick="studioKit('${a.id}')" id="studio-export" ${a.app_name && a.bundle_id && a.theme_preset ? '' : 'disabled title="Save app name, App ID and theme first"'}>⬇ Export App Kit</button>
          ${nextStatus ? `<button class="btn" onclick="studioStatus('${a.id}','${nextStatus}')" id="studio-next">Mark as ${label[nextStatus]}</button>` : ''}
          ${a.app_status !== 'details_pending' ? `<select class="select" style="width:auto" onchange="studioStatus('${a.id}',this.value)">${s.statuses.map((x) => `<option value="${x.key}" ${x.key === a.app_status ? 'selected' : ''}>${x.label}</option>`).join('')}</select>` : ''}
        </div></div>
      <div class="studio-grid">
        <div>
          <div class="card pad"><h3 class="card-t">App identity</h3>
            <div class="field"><label>App name (shown under the icon)</label><input class="input" id="st_name" maxlength="30" value="${esc(d.app_name)}" oninput="dset('app_name',this.value)"></div>
            <div class="field"><label>App ID / package name</label><input class="input" id="st_bundle" value="${esc(d.bundle_id)}" oninput="dset('bundle_id',this.value.toLowerCase())"><div class="hint">Auto-made from the shop name · used for both Play Store and App Store · cannot change after publishing</div></div>
            <div class="grid g2"><div class="field"><label>Logo (square PNG, 1024px best)</label><input type="file" accept="image/png,image/jpeg,image/webp" onchange="studioUpload(this,'logo_url')" id="st_logo"></div>
              <div class="field"><label>Splash image (optional)</label><input type="file" accept="image/png,image/jpeg" onchange="studioUpload(this,'splash_url')" id="st_splash"></div></div>
            <div class="grid g2"><div class="field"><label>Version</label><input class="input" value="${esc(d.app_version)}" oninput="dset('app_version',this.value)"></div>
              <div class="field"><label>Support email</label><input class="input" value="${esc(d.support_email)}" oninput="dset('support_email',this.value)"></div></div>
          </div>
          <div class="card pad section"><h3 class="card-t">Theme</h3><div class="themes">${themes}</div></div>
          <div class="card pad section"><h3 class="card-t">Store listing <span class="sub">auto-written · edit if you like</span></h3>
            <div class="field"><label>Short description (80)</label><input class="input" maxlength="80" value="${esc(d.store_short)}" oninput="dset('store_short',this.value)"></div>
            <div class="field"><label>Full description</label><textarea class="input" rows="7" oninput="dset('store_long',this.value)">${esc(d.store_long)}</textarea></div>
            <div class="field"><label>Keywords (100)</label><input class="input" maxlength="100" value="${esc(d.store_keywords)}" oninput="dset('store_keywords',this.value)"></div>
            <div class="kv"><span>Privacy policy</span><a href="${esc(a.config.store.privacyPolicyUrl)}" target="_blank">${esc(a.config.store.privacyPolicyUrl)}</a></div>
            <div class="kv"><span>Terms</span><a href="${esc(a.config.store.termsUrl)}" target="_blank">${esc(a.config.store.termsUrl)}</a></div>
          </div>
        </div>
        <div class="studio-preview-col"><div class="sub" style="margin-bottom:8px">Live preview · ${esc(s.presets[d.theme_preset].label)}</div><div id="studio-preview">${phone()}</div>
          <div class="sub" style="margin-top:10px">Tenant ID <code>${esc(a.id)}</code></div></div>
      </div></div></div>`;
}
async function studioUpload(inp, key) {
  const f = inp.files[0]; if (!f) return;
  try { const url = await uploadImage(f, 'master_token', '/master/v3/upload'); S.draft[key] = url; toast(key === 'logo_url' ? 'Logo uploaded · save to keep it' : 'Splash uploaded · save to keep it'); render(); } catch (e) { toast(e.message, true); }
}
async function studioSave() {
  const b = $('#studio-save'); b.disabled = true;
  try { const r = await api('/master/app-studio/' + S.studioSel, { method: 'PUT', body: S.draft });
    S.studio.apps = S.studio.apps.map((x) => x.id === r.id ? r : x); pickDraft(); toast('App details saved'); render();
  } catch (e) { toast(e.message, true); b.disabled = false; }
}
async function studioStatus(id, status) {
  try { const r = await api(`/master/app-studio/${id}/status`, { method: 'PUT', body: { status } }); S.studio.apps = S.studio.apps.map((x) => x.id === r.id ? r : x); toast('Status updated'); render(); } catch (e) { toast(e.message, true); render(); }
}
async function studioKit(id) {
  const b = $('#studio-export'); b.disabled = true;
  try {
    // Export always reflects what is on screen: save unsaved edits first
    const saved = await api('/master/app-studio/' + id, { method: 'PUT', body: S.draft });
    S.studio.apps = S.studio.apps.map((x) => x.id === saved.id ? saved : x);
    const r = await fetch(API + `/master/app-studio/${id}/kit`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('master_token') } });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Export failed'); }
    const blob = await r.blob(); const cd = r.headers.get('Content-Disposition') || ''; const fn = (cd.match(/filename="([^"]+)"/) || [])[1] || 'app-kit.zip';
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    toast('App Kit downloaded'); render();
  } catch (e) { toast(e.message, true); }
  b.disabled = false;
}
