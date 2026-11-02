/* Shop panel: Catalogue (making %), App Content, SIP, Gold Goals */
async function uploadImage(file, tokenKey, path) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(API + path, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem(tokenKey) }, body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || 'Upload failed');
  return d.url;
}

const DEFAULT_BANNERS = [
  { id: 'd1', image_url: '/api/admin/assets/img-banner-1.jpg', eyebrow: 'LBMA CERTIFIED', title: '24K 99.9% Pure LBMA Certified Gold', subtitle: 'Start saving with just ₹10' },
  { id: 'd2', image_url: '/api/admin/assets/img-banner-2.jpg', eyebrow: "INSURED BY BRINK'S", title: 'Doorstep Vault Delivery', subtitle: "Insured delivery of gold coins & bars by BRINK'S" },
];
const LINKS = [['', 'Nothing (image only)'], ['buy', 'Buy gold'], ['sip', 'Start SIP'], ['jewellery', 'Jewellery catalogue'], ['refer', 'Refer & earn']];

function phonePreview(banners, idx, shopName) {
  const list = banners.length ? banners : DEFAULT_BANNERS;
  const b = list[idx % list.length];
  return `<div class="phone"><div class="phone-notch"></div><div class="phone-screen">
    <div class="ph-head"><div class="ph-logo">${esc(initials(shopName).slice(0, 1))}</div><b>${esc(shopName)}</b></div>
    <div class="ph-banner" style="background-image:linear-gradient(180deg,transparent 30%,rgba(17,24,39,.88)),url('${esc(b.image_url)}')">
      <div class="ph-body">${b.eyebrow ? `<span class="ph-eyebrow">${esc(b.eyebrow)}</span>` : ''}${b.title ? `<div class="ph-title">${esc(b.title)}</div>` : ''}${b.subtitle ? `<div class="ph-sub">${esc(b.subtitle)}</div>` : ''}</div></div>
    <div class="ph-dots">${list.map((_, i) => `<i class="${i === idx % list.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="ph-skel"></div><div class="ph-skel short"></div><div class="ph-row"><div class="ph-skel"></div><div class="ph-skel"></div></div>
  </div></div>
  <div style="text-align:center;font-size:12px;color:var(--mute);margin-top:10px">${banners.length ? `Live in app · ${banners.length} banner${banners.length > 1 ? 's' : ''}` : 'App is showing the 2 default banners'}</div>`;
}

/* ── catalogue ── */
async function loadCat() { try { S.cat = await api('/jeweller/v3/catalogue'); } catch (e) { toast(e.message, true); } if (S.tab === 'catalogue') render(); }
function vCatalogue2() {
  const head = `<div class="page-head"><div><h2>Catalogue</h2><p>Price = metal value at the product's purity (24K = 100% live rate, 22K = 91.67%, 18K = 75%) + the making % you enter. Prices follow the live rate automatically.</p></div><button class="btn gold" onclick="addProduct2()" id="add-product">${icon('plus')} Add product</button></div>`;
  const c = S.cat; if (!c) return head + loading;
  const pur = (p) => ['24K', '22K', '18K'].map((k) => `<option value="${k}" ${p.purity === k ? 'selected' : ''}>${k} · ${({ '24K': '100', '22K': '91.67', '18K': '75' })[k]}%</option>`).join('');
  const p0 = c.products[0];
  const byP = (k) => c.products.find((p) => p.purity === k);
  const comm = ['24K', '22K', '18K'].filter(byP).map((k) => `${k} ${inr(byP(k).commission_per_g)}`).join(' · ');
  return head + (p0 ? `<div class="grid g3" style="margin-bottom:16px">
      ${kpi('Live gold rate', inr(p0.live_rate) + '<small>/g</small>', '24K, from market feed', 'rate')}
      ${kpi('Your commission', `<span style="font-size:18px">${comm}</span><small>/g</small>`, 'per purity · edit in Commission', 'commission')}
      ${kpi('Products', c.products.length, 'shown in the app', 'catalogue', 'blue')}</div>` : '') + `
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Image</th><th>Product</th><th>Category</th><th class="r">Weight</th><th>Purity</th><th class="r">Rate / g</th><th>Making %</th><th class="r">Total price</th><th></th></tr></thead><tbody>
    ${c.products.length ? c.products.map((p) => `<tr><td><div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div></td>
      <td><b>${esc(p.name)}</b><div class="sub"><code>${esc(p.sku)}</code>${p.tag ? ' · ' + esc(p.tag) : ''}</div></td>
      <td style="text-transform:capitalize">${esc(p.category.replace('-', ' '))}</td><td class="r num">${g4(p.grams)}</td>
      <td><select class="select" style="width:128px" onchange="setPurity('${p.id}',this.value)" data-purity="${p.id}">${pur(p)}</select></td>
      <td class="r num" style="white-space:nowrap">${inr(p.buy_rate)}<div class="sub">${p.purity} of live ${inr(p.live_rate)}</div></td>
      <td><div style="display:flex;gap:6px;align-items:center"><input class="input num" type="number" min="0" max="40" step="0.5" style="width:76px" value="${p.making_pct}" id="mk_${p.id}" data-making="${p.id}"><button class="btn sm" onclick="setMaking('${p.id}',$('#mk_${p.id}').value)">Set</button></div></td>
      <td class="r num"><b>${inr0(p.total_price)}</b><div class="sub">metal ${inr0(p.metal_value)} + making ${inr0(p.making_amount)}</div></td>
      <td class="r"><button class="btn sm danger" onclick="delProduct('${p.id}')">Remove</button></td></tr>`).join('') : emptyRow(9, 'No products yet', 'Add your first product to show it in the app.')}
    </tbody></table></div></div>`;
}
async function setPurity(id, v) { const p = S.cat.products.find((x) => x.id === id); try { await api(`/jeweller/v3/products/${id}/making`, { method: 'PUT', body: { making_pct: p.making_pct, purity: v } }); toast(`Purity set to ${v}`); loadCat(); } catch (e) { toast(e.message, true); } }
async function setMaking(id, v) { try { await api(`/jeweller/v3/products/${id}/making`, { method: 'PUT', body: { making_pct: Number(v) } }); toast(`Making set to ${v}%`); loadCat(); } catch (e) { toast(e.message, true); } }
function addProduct2() {
  openModal(`<div class="modal-h"><div><h3>Add product</h3><p>Appears in the app's Jewellery tab right away</p></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-b grid g2">
      <div class="field" style="grid-column:1/-1"><label>Name</label><input class="input" id="pn" placeholder="Heritage Necklace"></div>
      <div class="field"><label>Category</label><select class="select" id="pc">${CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="field"><label>Tag (optional)</label><input class="input" id="pt" placeholder="Bestseller"></div>
      <div class="field"><label>Weight (grams)</label><input class="input" id="pg" type="number" step="0.01" min="0.01"></div>
      <div class="field"><label>Purity</label><select class="select" id="pp"><option value="24K">24K · 100%</option><option value="22K" selected>22K · 91.67%</option><option value="18K">18K · 75%</option></select></div>
      <div class="field"><label>Making %</label><input class="input" id="pm" type="number" min="0" max="40" step="0.5" value="12"></div>
      <div class="field" style="grid-column:1/-1"><label>Photo</label><input class="input" id="pf" type="file" accept="image/png,image/jpeg,image/webp" style="padding-top:8px"></div>
      <div class="field" style="grid-column:1/-1"><label>Description (optional)</label><input class="input" id="pd"></div>
    </div><div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="save-product" onclick="saveProduct2()">Add product</button></div>`);
}
async function saveProduct2() {
  const b = $('#save-product'); b.disabled = true; b.textContent = 'Saving…';
  try {
    const f = $('#pf').files[0];
    const image_url = f ? await uploadImage(f, 'jeweller_token', '/jeweller/v3/upload') : '';
    await api('/jeweller/products', { method: 'POST', body: { name: $('#pn').value, category: $('#pc').value, tag: $('#pt').value, grams: Number($('#pg').value), making_pct: Number($('#pm').value), purity: $('#pp').value, image_url, description: $('#pd').value } });
    closeModal(); toast('Product added'); loadCat();
  } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Add product'; }
}

/* ── app content ── */
async function loadContent() { try { S.content = await api('/jeweller/v3/content'); } catch (e) { toast(e.message, true); } if (S.tab === 'content') render(); }
let pvTimer;
function vContent() {
  const head = `<div class="page-head"><div><h2>App Content</h2><p>Banners and questions shown inside your customer app. Changes go live instantly — no app update needed.</p></div></div>`;
  const c = S.content; if (!c) return head + loading;
  clearInterval(pvTimer); S.pv = S.pv || 0;
  pvTimer = setInterval(() => { if (S.tab !== 'content' || !$('#preview')) return clearInterval(pvTimer); S.pv++; $('#preview').innerHTML = phonePreview(S.content.banners.length ? S.content.banners : S.content.platform_banners, S.pv, S.me.business_name); }, 3500);
  return head + `<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:16px">
    <div class="card"><div class="card-h"><div><h3>Banners</h3><p>Shown at the top of the home screen. Wide images work best (about 1200×600).</p></div><span class="badge plain">${c.banners.length}/8</span></div>
      <div style="padding:20px" class="grid g3">
        <div class="field"><label>Small label</label><input class="input" id="bn_e" placeholder="FESTIVE OFFER" maxlength="60" oninput="bnPreview()"></div>
        <div class="field"><label>Title</label><input class="input" id="bn_t" placeholder="Diwali offer" maxlength="120" oninput="bnPreview()"></div>
        <div class="field"><label>Subtitle</label><input class="input" id="bn_s" placeholder="Reduced making this week" maxlength="200" oninput="bnPreview()"></div>
        <div class="field"><label>Links to</label><select class="select" id="bn_l">${LINKS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:span 2"><label>Image</label><input class="input" type="file" id="bn_f" accept="image/png,image/jpeg,image/webp" style="padding-top:8px" onchange="bnPreview()"></div>
        <div style="grid-column:1/-1"><button class="btn gold" id="add-banner" onclick="addBanner()">${icon('plus')} Add banner</button></div>
      </div>
      <div class="list">${c.banners.length ? c.banners.map((b) => `<div class="item"><div class="thumb wide" style="background-image:url('${esc(b.image_url)}')"></div><div class="grow"><div class="t">${esc(b.title || 'Image only')}</div><div class="s">${esc(b.subtitle || '')}${b.link ? ' · opens ' + esc(b.link) : ''}</div></div><button class="btn sm danger" onclick="delContent('banners','${b.id}')">Remove</button></div>`).join('')
        : '<div class="empty"><b>No banners yet</b>Your app shows the platform default banners until you add one.</div>'}</div></div>
    <div class="card"><div class="card-h"><div><h3>Questions & answers</h3><p>Shown on the app's FAQ screen. Only promise what you can deliver.</p></div></div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:12px">
        <div class="field"><label>Question</label><input class="input" id="fq" placeholder="Do you offer gift wrapping?"></div>
        <div class="field"><label>Answer</label><textarea class="input" id="fa" rows="3" style="height:auto;padding:10px 12px" placeholder="Yes — ask at the counter when collecting."></textarea></div>
        <div><button class="btn primary" onclick="addFaq()" id="add-faq">Add question</button></div></div>
      <div class="list">${c.faqs.length ? c.faqs.map((f) => `<div class="item"><div class="grow"><div class="t">${esc(f.question)}</div><div class="s">${esc(f.answer)}</div></div><button class="btn sm danger" onclick="delContent('faqs','${f.id}')">Remove</button></div>`).join('')
        : '<div class="empty"><b>No custom questions</b>The app shows the standard FAQ.</div>'}</div></div>
    </div>
    <div class="card pad" style="position:sticky;top:84px"><div style="font-weight:600;margin-bottom:12px">Live preview</div><div id="preview">${phonePreview(c.banners.length ? c.banners : (c.platform_banners || []), S.pv, S.me.business_name)}</div></div>
  </div>`;
}
function bnPreview() {
  const f = $('#bn_f').files[0];
  const draft = { id: 'draft', eyebrow: $('#bn_e').value, title: $('#bn_t').value, subtitle: $('#bn_s').value, image_url: f ? URL.createObjectURL(f) : (S.content.banners[0]?.image_url || DEFAULT_BANNERS[0].image_url) };
  clearInterval(pvTimer);
  $('#preview').innerHTML = phonePreview([draft], 0, S.me.business_name).replace('Live in app · 1 banner', 'Preview of your new banner');
}
async function addBanner() {
  const f = $('#bn_f').files[0]; if (!f) return toast('Choose an image first', true);
  const b = $('#add-banner'); b.disabled = true; b.textContent = 'Uploading…';
  try { const url = await uploadImage(f, 'jeweller_token', '/jeweller/v3/upload');
    await api('/jeweller/v3/banners', { method: 'POST', body: { eyebrow: $('#bn_e').value, title: $('#bn_t').value, subtitle: $('#bn_s').value, link: $('#bn_l').value, image_url: url } });
    toast('Banner is live in the app'); loadContent();
  } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Add banner'; }
}
async function addFaq() { try { await api('/jeweller/v3/faqs', { method: 'POST', body: { question: $('#fq').value, answer: $('#fa').value } }); toast('Question added'); loadContent(); } catch (e) { toast(e.message, true); } }
async function delContent(kind, id) { if (!confirm('Remove from the app?')) return; try { await api(`/jeweller/v3/${kind}/${id}`, { method: 'DELETE' }); toast('Removed'); loadContent(); } catch (e) { toast(e.message, true); } }

/* ── SIP ── */
function sipView(data, filters, onStatus, onSearch, showShop) {
  const s = data.summary;
  const freq = s.by_frequency; const tot = Math.max(1, freq.daily + freq.weekly + freq.monthly);
  return `<div class="grid g4">
      ${kpi('Active SIPs', s.active, `${s.paused} paused · ${s.cancelled || 0} cancelled`, 'refresh', 'green')}
      ${kpi('Monthly SIP value', inr0(s.monthly_value), 'expected every month', 'trend')}
      ${kpi('Gold saved via SIP', g4(s.gold_grams), `${s.gold_active} active gold SIP${s.gold_active === 1 ? '' : 's'}`, 'coin')}
      ${kpi('Silver saved via SIP', g4(s.silver_grams), `${s.silver_active} active silver SIP${s.silver_active === 1 ? '' : 's'}`, 'coin', 'gray')}
</div><div class="grid g2 section">${kpi('Total invested', inr0(s.invested), `through SIP · ${s.installments} instalments paid`, 'wallet', 'blue')}${kpi('Monthly by metal', `${s.gold_active} gold · ${s.silver_active} silver`, 'active plans', 'refresh')}</div>
    <div class="grid section" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr);align-items:start">
      <div class="card pad"><div style="font-weight:600;margin-bottom:14px">Active plans by frequency</div>
        ${['daily', 'weekly', 'monthly'].map((f) => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="text-transform:capitalize">${f}</span><b>${freq[f]}</b></div>
          <div class="bar-track"><div style="width:${(freq[f] / tot) * 100}%"></div></div></div>`).join('')}
        <div class="note gray" style="margin-top:6px">${icon('rate')}<span>Each instalment buys gold or silver at your live buy rate.</span></div></div>
      <div class="card"><div class="card-h"><div class="seg">${[['all', 'All'], ['active', 'Active'], ['paused', 'Paused'], ['cancelled', 'Cancelled']].map(([k, l]) => `<button class="${filters.status === k ? 'on' : ''}" onclick="${onStatus}('${k}')">${l}</button>`).join('')}</div>
        <input class="input search" placeholder="Name or phone" value="${esc(filters.search)}" oninput="${onSearch}(this.value)"></div>
        <div class="table-wrap"><table><thead><tr><th>Customer</th>${showShop ? '<th>Shop</th>' : ''}<th>Metal</th><th class="r">Amount</th><th>Frequency</th><th class="r">Paid</th><th class="r">Saved</th><th class="r">Invested</th><th>Next debit</th><th>Status</th></tr></thead><tbody>
        ${data.sips.length ? data.sips.map((x) => `<tr><td><b>${esc(x.customer)}</b><div class="sub">${phoneFmt(x.phone)} · since ${dOnly(x.created_at)}</div></td>${showShop ? `<td>${esc(x.shop)}</td>` : ''}
          <td>${metalTag(x.metal)}</td><td class="r num"><b>${inr0(x.amount)}</b></td><td style="text-transform:capitalize">${esc(x.frequency)}</td><td class="r num">${x.installments}</td>
          <td class="r num">${g4(x.grams)}</td><td class="r num">${inr0(x.invested)}</td><td>${x.status === 'active' ? dOnly(x.next_run) : '—'}</td><td>${x.status === 'paused' ? '<span class="badge amber">Paused</span>' : x.status === 'cancelled' ? '<span class="badge red">Cancelled</span>' : statusBadge(x.status)}</td></tr>`).join('') : emptyRow(showShop ? 10 : 9, 'No SIPs yet', 'Customers start a SIP from the SIP tab in the app.')}
        </tbody></table></div></div></div>`;
}
const SF = { status: 'all', search: '' };
let sTimer;
async function loadSips() { try { S.sips = await api(`/jeweller/v3/sips?status=${SF.status}&search=${encodeURIComponent(SF.search)}`); } catch (e) { toast(e.message, true); } if (S.tab === 'sips') render(); }
function sipStatus(k) { SF.status = k; loadSips(); }
function sipSearch(v) { SF.search = v; clearTimeout(sTimer); sTimer = setTimeout(loadSips, 300); }
function vSips() {
  const head = `<div class="page-head"><div><h2>SIP</h2><p>Customers saving in gold and silver automatically — daily, weekly or monthly.</p></div></div>`;
  return head + (S.sips ? sipView(S.sips, SF, 'sipStatus', 'sipSearch', false) : loading);
}

/* ── goals ── */
function goalsTable(list, showShop) {
  return `<div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th>${showShop ? '<th>Shop</th>' : ''}<th>Goal</th><th>Metal</th><th class="r">Target</th><th class="r">Saved</th><th style="width:200px">Progress</th><th>Deadline</th></tr></thead><tbody>
    ${list.length ? list.map((g) => `<tr><td><b>${esc(g.customer)}</b><div class="sub">${phoneFmt(g.phone)}</div></td>${showShop ? `<td>${esc(g.shop || '')}</td>` : ''}<td>${esc(g.name)}<div class="sub" style="text-transform:capitalize">${esc(g.occasion || '')}</div></td>
      <td>${metalTag(g.metal)}</td><td class="r num">${g4(g.target_grams)}</td><td class="r num">${g4(g.saved_grams)}</td><td><div class="bar-track"><div style="width:${g.progress}%"></div></div><div class="sub">${g.progress}%</div></td><td>${dOnly(g.deadline)}</td></tr>`).join('') : emptyRow(showShop ? 8 : 7, 'No goals yet')}
    </tbody></table></div></div>`;
}
async function loadGoals() { try { S.goals = await api('/jeweller/v3/goals'); } catch (e) { toast(e.message, true); } if (S.tab === 'goals') render(); }
function vGoals() {
  const head = `<div class="page-head"><div><h2>Gold & Silver Goals</h2><p>What your customers are saving towards — weddings, festivals and more.</p></div></div>`;
  return head + (S.goals ? goalsTable(S.goals, false) : loading);
}

/* ── shared: info pop-up, customer drawer, KYC details ── */
function infoModal(title, text, rows = []) {
  openModal(`<div class="modal-h"><div><h3>${esc(title)}</h3><p>${esc(text)}</p></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-b" data-testid="info-modal">${rows.length ? rows.map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b class="num">${v}</b></div>`).join('') : ''}</div>`);
}
async function photoInto(elId, path, tokenKey) {
  try {
    const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + localStorage.getItem(tokenKey) } });
    const el = document.getElementById(elId); if (!el) return;
    if (!r.ok) { el.innerHTML = '<span>No photo submitted</span>'; return; }
    el.innerHTML = `<img src="${URL.createObjectURL(await r.blob())}" alt="KYC photo" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
  } catch { const el = document.getElementById(elId); if (el) el.innerHTML = '<span>Photo unavailable</span>'; }
}
function kycDetails(c, photoPath, tokenKey, actions = '') {
  const k = c.kyc || {};
  openModal(`<div class="modal-h"><div><h3>KYC details</h3><p>${esc(c.name)} · ${statusBadge(c.kyc_status)}</p></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-b" data-testid="kyc-detail-modal"><div style="display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:start">
      <div id="kyc-photo" style="width:150px;height:180px;border-radius:12px;background:#F4F1EA;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--mute);text-align:center">Loading photo…</div>
      <div>
        <div class="kv"><span>Name on PAN</span><b>${esc(k.full_name || k.name || c.name)}</b></div>
        <div class="kv"><span>PAN</span><b><code>${esc(k.pan || '—')}</code></b></div>
        <div class="kv"><span>Aadhaar</span><b><code>${esc(k.aadhaar ? 'XXXX XXXX ' + String(k.aadhaar).slice(-4) : '—')}</code></b></div>
        <div class="kv"><span>Date of birth</span><b>${esc(k.dob || c.dob || '—')}</b></div>
        <div class="kv"><span>Gender</span><b style="text-transform:capitalize">${esc(c.gender || '—')}</b></div>
        <div class="kv"><span>Mobile</span><b>${phoneFmt(c.phone)}</b></div>
        <div class="kv"><span>Email</span><b>${esc(c.email || '—')}</b></div>
        <div class="kv"><span>Wallet ID</span><b><code>${esc(c.wallet_id)}</code></b></div>
        <div class="kv"><span>Submitted</span><b>${k.submitted_at ? dt(k.submitted_at) : '—'}</b></div>
        <div class="kv"><span>Customer since</span><b>${dOnly(c.created_at)}</b></div>
      </div></div></div>${actions ? `<div class="modal-f">${actions}</div>` : ''}`, true);
  photoInto('kyc-photo', photoPath, tokenKey);
}
function customerDrawer(d, showShop) {
  const c = d.customer;
  const evIc = (o) => o.side === 'redeem' ? '<div class="ic out">↗</div>' : '<div class="ic">+</div>';
  const lbl = { buy: 'Bought', buy_silver: 'Bought', sip: 'SIP purchase', redemption: 'Redeemed', referral_bonus: 'Referral bonus' };
  const big = (v, l, gold) => `<div><div style="font-size:24px;font-weight:700;${gold ? 'color:var(--gold2)' : ''}" class="num">${v}</div><div style="font-size:12px;color:#CDBF98">${l}</div></div>`;
  openDrawer(`<div class="drawer-h"><div class="avatar" style="width:46px;height:46px;font-size:16px">${esc(initials(c.name))}</div><div style="flex:1;min-width:0"><h3 style="font-size:18px">${esc(c.name)}</h3><div style="font-size:13px;color:var(--mute)">${phoneFmt(c.phone)} · ${esc(c.wallet_id)}${showShop ? ' · ' + esc(d.shop) : ''}</div></div><button class="x" onclick="closeDrawer()">×</button></div>
    <div class="drawer-b" data-testid="customer-drawer">
      <div class="card" style="background:linear-gradient(135deg,#1A1710,#2E2614);color:#fff;border:0;padding:20px">
        <div style="font-size:12px;color:#CDBF98">Current holdings</div>
        <div style="display:flex;gap:24px;margin-top:8px;flex-wrap:wrap">${big(g4(c.gold_grams), 'Gold 24K')}${big(inr0(d.gold_value), 'Gold value', 1)}${big(g4(c.silver_grams), 'Silver 999')}${big(inr0(d.silver_value), 'Silver value', 1)}</div></div>
      <div class="grid g2"><div class="card pad"><div style="font-size:12px;color:var(--mute)">Average buy price</div><div style="font-size:16px;font-weight:700;margin-top:4px" class="num">Gold ${inr(c.avg_buy_price)}/g</div><div style="font-size:13px;color:var(--mute)" class="num">Silver ${inr(d.avg_silver)}/g</div></div>
        <div class="card pad"><div style="font-size:12px;color:var(--mute)">Purchased · Redeemed</div><div style="font-size:16px;font-weight:700;margin-top:4px" class="num">${g4(d.purchased.gold_g)} gold · ${g4(d.purchased.silver_g)} silver</div><div style="font-size:13px;color:var(--mute)" class="num">${inr0(d.purchased.amount)} · ${d.purchased.count} orders · ${g4(d.redeemed.gold_g)} redeemed</div></div></div>
      <div class="card pad"><div class="kv"><span>KYC</span><b>${statusBadge(c.kyc_status)}</b></div><div class="kv"><span>Email</span><b>${esc(c.email || '—')}</b></div><div class="kv"><span>Date of birth</span><b>${esc(c.dob || '—')}</b></div><div class="kv"><span>Gender</span><b style="text-transform:capitalize">${esc(c.gender || '—')}</b></div><div class="kv"><span>Referral code</span><b><code>${esc(c.referral_code)}</code></b></div><div class="kv"><span>Customer since</span><b>${dOnly(c.created_at)}</b></div></div>
      ${d.sips.length ? `<div class="card"><div class="card-h"><h3>SIPs</h3></div><div class="list">${d.sips.map((x) => `<div class="item"><div class="grow"><div class="t">${inr0(x.amount)} / ${esc(x.frequency)} · ${metalTag(x.metal)}</div><div class="s">${x.installments} paid</div></div>${statusBadge(x.status)}</div>`).join('')}</div></div>` : ''}
      ${d.pickups.length ? `<div class="card"><div class="card-h"><h3>Store pickups</h3></div><div class="list">${d.pickups.map((p) => `<div class="item"><div class="grow"><div class="t">${esc(p.item)}</div><div class="s">${g4(p.grams)} · ${dt(p.created_at)}</div></div>${statusBadge(p.status)}</div>`).join('')}</div></div>` : ''}
      <div class="card"><div class="card-h"><h3>Activity</h3><span style="font-size:12px;color:var(--mute)">${d.timeline.length} entries</span></div><div class="timeline">
        ${d.timeline.length ? d.timeline.map((o) => `<div class="ev">${evIc(o)}<div class="grow"><div style="font-weight:600">${lbl[o.type] || o.type} · ${metalTag(o.metal)}</div><div style="font-size:12px;color:var(--mute)">${dt(o.created_at)} · ${esc(o.invoice_no)}</div></div>
          <div style="text-align:right"><div class="num" style="font-weight:600">${o.side === 'redeem' ? '−' : '+'}${g4(o.grams)}</div><div style="font-size:12px;color:var(--mute)" class="num">${inr(o.total)}</div></div></div>`).join('') : '<div class="empty">No activity yet</div>'}
      </div></div></div>`);
}
