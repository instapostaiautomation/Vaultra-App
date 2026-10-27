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
const LINKS = [['', 'Nothing (image only)'], ['buy', 'Buy gold'], ['sip', 'Start SIP'], ['jewellery', 'Jewellery catalogue'], ['gift', 'Gift gold'], ['refer', 'Refer & earn']];

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
  const head = `<div class="page-head"><div><h2>Catalogue</h2><p>Price = live rate + your commission, plus the making % you choose. Prices follow the live rate automatically.</p></div><button class="btn gold" onclick="addProduct2()" id="add-product">${icon('plus')} Add product</button></div>`;
  const c = S.cat; if (!c) return head + loading;
  const opts = (v) => c.options.map((o) => `<option value="${o}" ${Number(v) === o ? 'selected' : ''}>${o}%</option>`).join('');
  const p0 = c.products[0];
  return head + (p0 ? `<div class="grid g3" style="margin-bottom:16px">
      ${kpi('Live gold rate', inr(p0.live_rate) + '<small>/g</small>', 'from market feed', 'rate')}
      ${kpi('Your commission', inr(p0.commission_per_g) + '<small>/g</small>', 'edit in Commission', 'commission')}
      ${kpi('Products', c.products.length, 'shown in the app', 'catalogue', 'blue')}</div>` : '') + `
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Image</th><th>Product</th><th>Category</th><th class="r">Weight</th><th class="r">Rate / g</th><th>Making</th><th class="r">Price</th><th></th></tr></thead><tbody>
    ${c.products.length ? c.products.map((p) => `<tr><td><div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div></td>
      <td><b>${esc(p.name)}</b><div class="sub"><code>${esc(p.sku)}</code>${p.tag ? ' · ' + esc(p.tag) : ''}</div></td>
      <td style="text-transform:capitalize">${esc(p.category.replace('-', ' '))}</td><td class="r num">${g4(p.grams)}</td>
      <td class="r num" style="white-space:nowrap">${inr(p.buy_rate)}<div class="sub">live ${inr(p.live_rate)} + comm. ${inr(p.commission_per_g)}</div></td>
      <td><select class="select" style="width:92px" onchange="setMaking('${p.id}',this.value)" data-making="${p.id}">${opts(p.making_pct)}</select></td>
      <td class="r num"><b>${inr0(p.total_price)}</b><div class="sub">metal ${inr0(p.metal_value)} + making ${inr0(p.making_amount)}</div></td>
      <td class="r"><button class="btn sm danger" onclick="delProduct('${p.id}')">Remove</button></td></tr>`).join('') : emptyRow(8, 'No products yet', 'Add your first product to show it in the app.')}
    </tbody></table></div></div>`;
}
async function setMaking(id, v) { try { await api(`/jeweller/v3/products/${id}/making`, { method: 'PUT', body: { making_pct: Number(v) } }); toast(`Making set to ${v}%`); loadCat(); } catch (e) { toast(e.message, true); } }
function addProduct2() {
  openModal(`<div class="modal-h"><div><h3>Add product</h3><p>Appears in the app's Jewellery tab right away</p></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-b grid g2">
      <div class="field" style="grid-column:1/-1"><label>Name</label><input class="input" id="pn" placeholder="Heritage Necklace"></div>
      <div class="field"><label>Category</label><select class="select" id="pc">${CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="field"><label>Tag (optional)</label><input class="input" id="pt" placeholder="Bestseller"></div>
      <div class="field"><label>Weight (grams)</label><input class="input" id="pg" type="number" step="0.01" min="0.01"></div>
      <div class="field"><label>Making</label><select class="select" id="pm">${(S.cat?.options || [9, 12, 14, 18, 22, 24]).map((o) => `<option value="${o}" ${o === 12 ? 'selected' : ''}>${o}%</option>`).join('')}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Photo</label><input class="input" id="pf" type="file" accept="image/png,image/jpeg,image/webp" style="padding-top:8px"></div>
      <div class="field" style="grid-column:1/-1"><label>Description (optional)</label><input class="input" id="pd"></div>
    </div><div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="save-product" onclick="saveProduct2()">Add product</button></div>`);
}
async function saveProduct2() {
  const b = $('#save-product'); b.disabled = true; b.textContent = 'Saving…';
  try {
    const f = $('#pf').files[0];
    const image_url = f ? await uploadImage(f, 'jeweller_token', '/jeweller/v3/upload') : '';
    await api('/jeweller/products', { method: 'POST', body: { name: $('#pn').value, category: $('#pc').value, tag: $('#pt').value, grams: Number($('#pg').value), making_pct: Number($('#pm').value), image_url, description: $('#pd').value } });
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
      ${kpi('Active SIPs', s.active, `${s.paused} paused · ${s.total} total`, 'refresh', 'green')}
      ${kpi('Monthly SIP value', inr0(s.monthly_value), 'expected every month', 'trend')}
      ${kpi('Gold saved via SIP', g4(s.grams), `${s.installments} instalment${s.installments === 1 ? '' : 's'} paid`, 'coin')}
      ${kpi('Total invested', inr0(s.invested), 'through SIP', 'wallet', 'blue')}</div>
    <div class="grid section" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr);align-items:start">
      <div class="card pad"><div style="font-weight:600;margin-bottom:14px">Active plans by frequency</div>
        ${['daily', 'weekly', 'monthly'].map((f) => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="text-transform:capitalize">${f}</span><b>${freq[f]}</b></div>
          <div class="bar-track"><div style="width:${(freq[f] / tot) * 100}%"></div></div></div>`).join('')}
        <div class="note gray" style="margin-top:6px">${icon('rate')}<span>Each instalment buys gold at your live buy rate.</span></div></div>
      <div class="card"><div class="card-h"><div class="seg">${[['all', 'All'], ['active', 'Active'], ['paused', 'Paused']].map(([k, l]) => `<button class="${filters.status === k ? 'on' : ''}" onclick="${onStatus}('${k}')">${l}</button>`).join('')}</div>
        <input class="input search" placeholder="Name or phone" value="${esc(filters.search)}" oninput="${onSearch}(this.value)"></div>
        <div class="table-wrap"><table><thead><tr><th>Customer</th>${showShop ? '<th>Shop</th>' : ''}<th class="r">Amount</th><th>Frequency</th><th class="r">Paid</th><th class="r">Gold saved</th><th class="r">Invested</th><th>Next debit</th><th>Status</th></tr></thead><tbody>
        ${data.sips.length ? data.sips.map((x) => `<tr><td><b>${esc(x.customer)}</b><div class="sub">${phoneFmt(x.phone)} · since ${dOnly(x.created_at)}</div></td>${showShop ? `<td>${esc(x.shop)}</td>` : ''}
          <td class="r num"><b>${inr0(x.amount)}</b></td><td style="text-transform:capitalize">${esc(x.frequency)}</td><td class="r num">${x.installments}</td>
          <td class="r num">${g4(x.grams)}</td><td class="r num">${inr0(x.invested)}</td><td>${x.status === 'active' ? dOnly(x.next_run) : '—'}</td><td>${statusBadge(x.status === 'paused' ? 'pending' : x.status).replace('>pending<', '>paused<')}</td></tr>`).join('') : emptyRow(showShop ? 9 : 8, 'No SIPs yet', 'Customers start a SIP from the SIP tab in the app.')}
        </tbody></table></div></div></div>`;
}
const SF = { status: 'all', search: '' };
let sTimer;
async function loadSips() { try { S.sips = await api(`/jeweller/v3/sips?status=${SF.status}&search=${encodeURIComponent(SF.search)}`); } catch (e) { toast(e.message, true); } if (S.tab === 'sips') render(); }
function sipStatus(k) { SF.status = k; loadSips(); }
function sipSearch(v) { SF.search = v; clearTimeout(sTimer); sTimer = setTimeout(loadSips, 300); }
function vSips() {
  const head = `<div class="page-head"><div><h2>SIP</h2><p>Customers saving in gold automatically — daily, weekly or monthly.</p></div></div>`;
  return head + (S.sips ? sipView(S.sips, SF, 'sipStatus', 'sipSearch', false) : loading);
}

/* ── goals ── */
function goalsTable(list, showShop) {
  return `<div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th>${showShop ? '<th>Shop</th>' : ''}<th>Goal</th><th class="r">Target</th><th class="r">Saved</th><th style="width:200px">Progress</th><th>Deadline</th></tr></thead><tbody>
    ${list.length ? list.map((g) => `<tr><td><b>${esc(g.customer)}</b><div class="sub">${phoneFmt(g.phone)}</div></td>${showShop ? `<td>${esc(g.shop || '')}</td>` : ''}<td>${esc(g.name)}<div class="sub" style="text-transform:capitalize">${esc(g.occasion || '')}</div></td>
      <td class="r num">${g4(g.target_grams)}</td><td class="r num">${g4(g.saved_grams)}</td><td><div class="bar-track"><div style="width:${g.progress}%"></div></div><div class="sub">${g.progress}%</div></td><td>${dOnly(g.deadline)}</td></tr>`).join('') : emptyRow(showShop ? 7 : 6, 'No gold goals yet')}
    </tbody></table></div></div>`;
}
async function loadGoals() { try { S.goals = await api('/jeweller/v3/goals'); } catch (e) { toast(e.message, true); } if (S.tab === 'goals') render(); }
function vGoals() {
  const head = `<div class="page-head"><div><h2>Gold Goals</h2><p>What your customers are saving towards — weddings, festivals and more.</p></div></div>`;
  return head + (S.goals ? goalsTable(S.goals, false) : loading);
}
