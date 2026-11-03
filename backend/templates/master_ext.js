const AUDIT_LABEL = { 'commission.update': 'Commission changed', 'pricing.update': 'Pricing changed', 'product.making': 'Making % changed', 'product.add': 'Product added', 'product.delete': 'Product removed', 'banner.add': 'Banner added', 'banner.delete': 'Banner removed', 'faq.add': 'FAQ added', 'faq.delete': 'FAQ removed', 'kyc.approved': 'KYC approved', 'kyc.rejected': 'KYC rejected' };
/* Master console: extra tabs */
const shopSel = (val, on) => `<select class="select" onchange="${on}"><option value="">All shops</option>${(S.jewellers || []).map((j) => `<option value="${j.id}" ${val === j.id ? 'selected' : ''}>${esc(j.business_name)}</option>`).join('')}</select>`;
const ph = (t, p, right = '') => `<div class="page-head"><div><h2>${t}</h2><p>${p}</p></div>${right}</div>`;
const needJ = async () => { if (!S.jewellers) S.jewellers = await api('/master/jewellers'); };

/* pricing */
const loadPricing = () => safe(async () => { S.pricing = await api('/master/v3/pricing'); S.price = {...S.pricing.price, feed: S.feed}; }, 'pricing');
function vPricing() {
  const head = ph('Pricing', 'Each shop\'s commission on top of the live rate. Changes reach that shop\'s app instantly.');
  const p = S.pricing; if (!p) return head + loading;
  return head + `<div class="grid g2" style="margin-bottom:16px">
    <div class="card rate-card"><div class="coin"></div><div><div class="label"><span class="dot ${p.price.live ? 'live' : ''}"></span> Live gold</div><div class="value num">${rv(p.price, p.price.base_rate)} <small>/g</small></div></div></div>
    <div class="card rate-card"><div class="coin silver"></div><div><div class="label"><span class="dot ${p.price.live ? 'live' : ''}"></span> Live silver</div><div class="value num">${rv(p.price, p.price.silver.base_rate)} <small>/g</small></div></div></div></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Shop</th><th>24K margin / g</th><th>22K margin / g</th><th>18K margin / g</th><th>Silver margin / g</th><th class="r">Customer rates</th><th></th></tr></thead><tbody>
    ${p.shops.map((s) => { const inp = (id, v, max) => `<div class="prefix" style="width:120px"><span>₹</span><input class="input num" type="number" min="-${max}" max="${max}" step="0.01" id="${id}_${s.id}" value="${v}"></div>`; return `<tr><td><b>${esc(s.shop)}</b><div class="sub">${statusBadge(s.status)}</div></td>
      <td>${inp('pg', s.gold_commission_per_g, 1000)}</td><td>${inp('p22', s.gold22_commission_per_g, 1000)}</td><td>${inp('p18', s.gold18_commission_per_g, 1000)}</td><td>${inp('ps', s.silver_commission_per_g, 100)}</td>
      <td class="r num" style="white-space:nowrap;font-size:12px">24K <b>${rv(p.price, s.karats['24K'])}</b><br>22K <b>${rv(p.price, s.karats['22K'])}</b><br>18K <b>${rv(p.price, s.karats['18K'])}</b><br>Silver <b>${rv(p.price, s.silver_buy)}</b></td>
      <td class="r"><button class="btn sm primary" onclick="savePricing('${s.id}')">Save</button></td></tr>`; }).join('')}</tbody></table></div></div>
    <div class="note gray section">${icon('rate')}<span>22K = live 24K × 22/24 and 18K = live 24K × 18/24, plus each shop's margin. Margins can be negative (discount). 24K and silver margins apply to digital gold/silver purchases.</span></div>`;
}
async function savePricing(id) { const n = (k) => Number($(`#${k}_${id}`).value || 0); try { await api('/master/v3/pricing/' + id, { method: 'PUT', body: { gold_per_g: n('pg'), silver_per_g: n('ps'), gold22_per_g: n('p22'), gold18_per_g: n('p18') } }); toast('Pricing updated'); loadPricing(); } catch (e) { toast(e.message, true); } }

/* catalogue */
S.catJ = '';
const loadMCat = () => safe(async () => { await needJ(); S.mcat = await api('/master/v3/catalogue?jeweller_id=' + S.catJ); }, 'catalogue');
function vMCatalogue() {
  const head = ph('Catalogue', 'Every product across all shops, priced by purity (24K = live rate, 22K = 91.67%, 18K = 75%) + shop commission + making charge set by each shop.', shopSel(S.catJ, "S.catJ=this.value;loadMCat()"));
  const c = S.mcat; if (!c) return head + loading;
  return head + `<div class="card"><div class="table-wrap"><table><thead><tr><th>Image</th><th>Product</th><th>Shop</th><th class="r">Weight</th><th>Purity</th><th class="r">Rate / g</th><th class="r">Price</th><th></th></tr></thead><tbody>
    ${c.products.length ? c.products.map((p) => `<tr><td><div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div></td><td><b>${esc(p.name)}</b><div class="sub"><code>${esc(p.sku)}</code></div></td><td>${esc(p.shop)}</td>
      <td class="r num">${g4(p.grams)}</td><td>${esc(p.purity)} · ${p.purity_pct}%</td><td class="r num">${inr(p.buy_rate)}</td><td class="r num"><b>${inr0(p.total_price)}</b></td>
      <td class="r"><button class="btn sm danger" onclick="mDel('products','${p.id}',loadMCat)">Remove</button></td></tr>`).join('') : emptyRow(8, 'No products')}</tbody></table></div></div>`;
}
async function mDel(kind, id, after) { if (!confirm('Remove this item?')) return; try { await api(`/master/v3/${kind}/${id}`, { method: 'DELETE' }); toast('Removed'); after(); } catch (e) { toast(e.message, true); } }

/* app content (platform defaults) */
const loadMContent = () => safe(async () => { S.mcontent = await api('/master/v3/content'); }, 'content');
function vMContent() {
  const head = ph('App Content', 'Platform default banners and FAQ — shown in any shop\'s app that hasn\'t added its own.');
  const c = S.mcontent; if (!c) return head + loading;
  return head + `<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start"><div style="display:flex;flex-direction:column;gap:16px">
    <div class="card"><div class="card-h"><h3>Default banners</h3><span class="badge plain">${c.banners.length}/8</span></div><div style="padding:20px" class="grid g3">
      <div class="field"><label>Small label</label><input class="input" id="mb_e" maxlength="60"></div><div class="field"><label>Title</label><input class="input" id="mb_t" maxlength="120"></div>
      <div class="field"><label>Subtitle</label><input class="input" id="mb_s" maxlength="200"></div><div class="field" style="grid-column:span 2"><label>Image</label><input class="input" type="file" id="mb_f" accept="image/png,image/jpeg,image/webp" style="padding-top:8px"></div>
      <div style="display:flex;align-items:flex-end"><button class="btn gold" id="m-add-banner" onclick="mAddBanner()">Add banner</button></div></div>
      <div class="list">${c.banners.length ? c.banners.map((b) => `<div class="item"><div class="thumb wide" style="background-image:url('${esc(b.image_url)}')"></div><div class="grow"><div class="t">${esc(b.title || 'Image only')}</div><div class="s">${esc(b.subtitle)}</div></div><button class="btn sm danger" onclick="mDel('banners','${b.id}',loadMContent)">Remove</button></div>`).join('') : '<div class="empty">Apps show the built-in banners.</div>'}</div></div>
    <div class="card"><div class="card-h"><h3>Default FAQ</h3></div><div style="padding:20px;display:flex;flex-direction:column;gap:12px">
      <input class="input" id="mf_q" placeholder="Question"><textarea class="input" id="mf_a" rows="3" style="height:auto;padding:10px 12px" placeholder="Answer"></textarea><div><button class="btn primary" onclick="mAddFaq()">Add question</button></div></div>
      <div class="list">${c.faqs.map((f) => `<div class="item"><div class="grow"><div class="t">${esc(f.question)}</div><div class="s">${esc(f.answer)}</div></div><button class="btn sm danger" onclick="mDel('faqs','${f.id}',loadMContent)">Remove</button></div>`).join('') || '<div class="empty">Apps show the built-in FAQ.</div>'}</div></div></div>
    <div class="card pad" style="position:sticky;top:84px"><div style="font-weight:600;margin-bottom:12px">Preview</div>${phonePreview(c.banners, 0, 'Your Store')}</div></div>`;
}
async function mAddBanner() { const f = $('#mb_f').files[0]; if (!f) return toast('Choose an image first', true); const b = $('#m-add-banner'); b.disabled = true;
  try { const url = await uploadImage(f, 'master_token', '/master/v3/upload'); await api('/master/v3/banners', { method: 'POST', body: { eyebrow: $('#mb_e').value, title: $('#mb_t').value, subtitle: $('#mb_s').value, image_url: url } }); toast('Banner added'); loadMContent(); } catch (e) { toast(e.message, true); b.disabled = false; } }
async function mAddFaq() { try { await api('/master/v3/faqs', { method: 'POST', body: { question: $('#mf_q').value, answer: $('#mf_a').value } }); toast('Added'); loadMContent(); } catch (e) { toast(e.message, true); } }

/* orders */
S.mo = { j: '', side: 'all', q: '' }; let moT;
const loadMOrders = () => safe(async () => { await needJ(); S.morders = await api(`/master/v3/orders?jeweller_id=${S.mo.j}&side=${S.mo.side}&search=${encodeURIComponent(S.mo.q)}`); }, 'orders');
function vMOrders() {
  const head = ph('Orders', 'Purchases and redemptions across every shop.', `<div class="toolbar">${shopSel(S.mo.j, "S.mo.j=this.value;loadMOrders()")}<div class="seg">${[['all', 'All'], ['buy', 'Buy'], ['redeem', 'Redeem']].map(([k, l]) => `<button class="${S.mo.side === k ? 'on' : ''}" onclick="S.mo.side='${k}';loadMOrders()">${l}</button>`).join('')}</div>
    <input class="input search" placeholder="Name, phone, invoice" value="${esc(S.mo.q)}" oninput="S.mo.q=this.value;clearTimeout(moT);moT=setTimeout(loadMOrders,300)"></div>`);
  const o = S.morders; if (!o) return head + loading;
  return head + `<div class="card"><div class="table-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Shop</th><th>Type</th><th>Metal</th><th class="r">Qty</th><th class="r">Total</th><th>Status</th><th></th></tr></thead><tbody>
    ${o.length ? o.map((x) => `<tr><td>${dt(x.created_at)}<div class="sub">${esc(x.invoice_no)}</div></td><td><b>${esc(x.customer_name)}</b><div class="sub">${phoneFmt(x.phone)}</div></td><td>${esc(x.shop)}</td>
      <td>${x.side === 'buy' ? '<span class="badge green plain">Buy</span>' : '<span class="badge amber plain">Redeem</span>'}</td><td>${metalTag(x.metal)}</td><td class="r num">${g4(x.grams)}</td><td class="r num"><b>${inr(x.total)}</b></td><td>${statusBadge(x.status)}</td>
      <td class="r"><button class="btn sm" onclick="mBill('${x.id}')">${icon('invoice')} Bill</button></td></tr>`).join('') : emptyRow(9, 'No orders')}</tbody></table></div></div>`;
}
async function mBill(id) { try { const b = await api(`/master/v3/orders/${id}/bill`); const o = b.order, c = b.customer, isR = o.side === 'redeem';
  openModal(`<div class="modal-h"><div><h3>${isR ? 'Redemption receipt' : 'Tax invoice'}</h3><p>${esc(o.invoice_no)} · ${dt(o.created_at)}</p></div><button class="x" onclick="closeModal()">×</button></div><div class="modal-b"><div class="bill">
    <div class="bill-top"><div><div class="shop">${esc(b.shop.name)}</div><div class="meta">${esc(b.shop.city || '')}</div></div>${statusBadge(o.status)}</div>
    <div class="bill-sec"><h4>Customer</h4><div class="kv"><span>Name</span><b>${esc(c.name)}</b></div><div class="kv"><span>Phone</span><b>${phoneFmt(c.phone)}</b></div></div>
    <div class="bill-sec"><h4>Details</h4><div class="kv"><span>Item</span><b>${esc(o.item)}</b></div><div class="kv"><span>Quantity</span><b>${g4(o.grams)}</b></div><div class="kv"><span>Rate</span><b>${inr(o.rate)}/g</b></div><div class="kv"><span>Amount</span><b>${inr(o.amount)}</b></div><div class="kv"><span>Charges</span><b>${inr(o.charges)}</b></div><div class="kv"><span>GST</span><b>${inr(isR ? 0 : o.gst)}</b></div></div>
    <div class="bill-total"><span>${isR ? 'Paid at store' : 'Total paid'}</span><span>${inr(isR ? o.charges : o.total)}</span></div></div></div>`); } catch (e) { toast(e.message, true); } }

/* KYC */
S.mk = 'pending';
const loadMKyc = () => safe(async () => { S.mkyc = await api('/master/v3/kyc?status=' + S.mk); }, 'kyc');
function vMKyc() {
  const head = ph('KYC', 'Identity checks across all shops.', `<div class="seg">${[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => `<button class="${S.mk === k ? 'on' : ''}" onclick="S.mk='${k}';loadMKyc()">${l}</button>`).join('')}</div>`);
  const k = S.mkyc; if (!k) return head + loading;
  return head + `<div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Shop</th><th>PAN</th><th>Photo</th><th>Status</th><th></th></tr></thead><tbody>
    ${k.length ? k.map((c) => `<tr><td><b>${esc(c.name)}</b><div class="sub">${phoneFmt(c.phone)}</div></td><td>${esc(c.shop)}</td><td><code>${esc((c.kyc || {}).pan || '—')}</code></td><td>${(c.kyc || {}).photo_id ? '<span class="badge green plain">Added</span>' : '<span class="badge plain">None</span>'}</td><td>${statusBadge(c.kyc_status)}</td>
      <td class="r" style="white-space:nowrap"><button class="btn sm" onclick="mKycView('${c.id}')">${icon('eye')} Full details</button> ${c.kyc_status === 'pending' ? `<button class="btn sm danger" onclick="mKyc('${c.id}',false)">Reject</button> <button class="btn sm primary" onclick="mKyc('${c.id}',true)">Approve</button>` : ''}</td></tr>`).join('') : emptyRow(6, 'Nothing here')}</tbody></table></div></div>`;
}
async function mKyc(id, ok) { try { await api(`/master/v3/kyc/${id}/decide?approve=${ok}`, { method: 'POST' }); toast(ok ? 'Approved' : 'Rejected'); loadMKyc(); } catch (e) { toast(e.message, true); } }

/* settlement */
S.sr = { range: '30d' };
const loadSettle = () => safe(async () => { S.settle = await api('/master/v3/settlement?' + rq(S.sr)); }, 'settlement');
function onSettleRange(k, apply) { if (k === 'custom' && apply) { S.sr.from = $('#r_from').value; S.sr.to = $('#r_to').value; } S.sr.range = k; if (k !== 'custom' || apply) loadSettle(); else render(); }
function vSettlement() {
  const head = ph('Settlement', 'Money collected per shop, split into metal cost, GST and the shop\'s commission.', rangeBar(S.sr, onSettleRange));
  const s = S.settle; if (!s) return head + loading; const t = s.totals;
  return head + `<div class="grid g4">${kpi('Collected', inr0(t.collected), 'from customers', 'wallet', 'green')}${kpi('Metal cost', inr0(t.metal_cost), 'paid for bullion', 'coin')}${kpi('GST', inr0(t.gst), 'to be filed', 'invoice', 'blue')}${kpi('Shop commission', inr0(t.commission), 'payable to shops', 'commission')}</div>
    <div class="card section"><div class="table-wrap"><table><thead><tr><th>Shop</th><th class="r">Orders</th><th class="r">Gold</th><th class="r">Silver</th><th class="r">Collected</th><th class="r">Metal cost</th><th class="r">GST</th><th class="r">Payable to shop</th></tr></thead><tbody>
    ${s.shops.map((x) => `<tr><td><b>${esc(x.shop)}</b></td><td class="r num">${x.orders}</td><td class="r num">${g4(x.gold_g)}</td><td class="r num">${g4(x.silver_g)}</td><td class="r num"><b>${inr(x.collected)}</b></td><td class="r num">${inr(x.metal_cost)}</td><td class="r num">${inr(x.gst)}</td><td class="r num"><b style="color:var(--gold)">${inr(x.payable)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* referrals, gifts, redemptions, goals, sips, audit */
const simpleLoad = (key, path, tab) => () => safe(async () => { S[key] = await api(path); }, tab);
const loadMRefs = simpleLoad('mrefs', '/master/v3/referrals', 'referrals');
const loadMGifts = simpleLoad('mgifts', '/master/v3/gifts', 'gifts');
const loadMRed = simpleLoad('mred', '/master/v3/redemptions', 'redemptions');
const loadMGoals = simpleLoad('mgoals', '/master/v3/goals', 'goals');
const loadAudit = simpleLoad('audit', '/master/v3/audit', 'audit');
function tableView(title, sub, data, cols, row) {
  const head = ph(title, sub); if (!data) return head + loading;
  return head + `<div class="card"><div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th${c.startsWith('>') ? ' class="r"' : ''}>${c.replace('>', '')}</th>`).join('')}</tr></thead><tbody>${data.length ? data.map(row).join('') : emptyRow(cols.length, 'Nothing yet')}</tbody></table></div></div>`;
}
const vMRefs = () => tableView('Referrals', 'Customers who invited friends, across all shops.', S.mrefs, ['Referred by', 'New customer', 'Shop', 'Joined', 'Status'],
  (x) => `<tr><td><b>${esc(x.referrer)}</b><div class="sub">${esc(x.code)}</div></td><td>${esc(x.referred)}<div class="sub">${phoneFmt(x.referred_phone)}</div></td><td>${esc(x.shop)}</td><td>${dOnly(x.joined)}</td><td>${x.has_gold ? '<span class="badge green">Bought gold</span>' : '<span class="badge plain">Signed up</span>'}</td></tr>`);
const vMGifts = () => tableView('Gifts', 'Gold gifted between customers.', S.mgifts, ['When', 'From', 'To', 'Shop', '>Gold', '>Value', 'Status'],
  (g) => `<tr><td>${dt(g.created_at)}</td><td>${esc(g.sender)}</td><td>${esc(g.recipient)}</td><td>${esc(g.shop)}</td><td class="r num">${g4(g.grams)}</td><td class="r num">${inr(g.amount)}</td><td>${g.seen ? '<span class="badge green">Opened</span>' : '<span class="badge plain">Delivered</span>'}</td></tr>`);
const vMRed = () => tableView('Redemptions', 'Physical coins and jewellery handed over at shops.', S.mred, ['Requested', 'Customer', 'Shop', 'Item', '>Grams', '>Making', 'Status'],
  (p) => `<tr><td>${dt(p.created_at)}</td><td><b>${esc(p.customer)}</b><div class="sub">${phoneFmt(p.phone)}</div></td><td>${esc(p.shop)}</td><td>${esc(p.item)}</td><td class="r num">${g4(p.grams)}</td><td class="r num">${inr(p.making_charges)}</td><td>${statusBadge(p.status)}</td></tr>`);
const vMGoals = () => ph('Gold & Silver Goals', 'What customers are saving towards.') + (S.mgoals ? goalsTable(S.mgoals, true) : loading);
const vAudit = () => tableView('Audit Log', 'Every important change made by shops and admins.', S.audit, ['When', 'By', 'Action', 'Target', 'Details'],
  (a) => `<tr><td>${dt(a.created_at)}</td><td><b>${esc(a.actor)}</b><div class="sub" style="text-transform:capitalize">${esc(a.actor_type)}</div></td><td><span class="badge gold plain">${esc(AUDIT_LABEL[a.action] || a.action.replace('.', ' · '))}</span></td><td>${esc(a.target)}</td><td class="sub">${esc(Object.entries(a.detail || {}).map(([k, v]) => k + ': ' + v).join(' · '))}</td></tr>`);
S.msf = { status: 'all', search: '' }; let msT;
const loadMSips = () => safe(async () => { S.msips = await api(`/master/v3/sips?status=${S.msf.status}&search=${encodeURIComponent(S.msf.search)}`); }, 'sips');
function mSipStatus(k) { S.msf.status = k; loadMSips(); }
function mSipSearch(v) { S.msf.search = v; clearTimeout(msT); msT = setTimeout(loadMSips, 300); }
const vMSips = () => ph('SIP', 'Gold and silver SIPs across every shop.') + (S.msips ? sipView(S.msips, S.msf, 'mSipStatus', 'mSipSearch', true) : loading);

/* shop catalogue drawer, customer details, KYC details */
async function shopCatalogue(jid) {
  openDrawer('<div class="drawer-b"><div class="skeleton"></div></div>');
  try {
    const c = await api('/master/v3/catalogue?jeweller_id=' + jid); const name = jname(jid);
    openDrawer(`<div class="drawer-h"><div style="flex:1"><h3 style="font-size:18px">${esc(name)} · Catalogue</h3><div style="font-size:13px;color:var(--mute)">${c.products.length} products · live prices</div></div><button class="x" onclick="closeDrawer()">×</button></div>
      <div class="drawer-b" data-testid="shop-catalogue-drawer">${c.products.length ? c.products.map((p) => `<div class="card" style="display:flex;gap:14px;padding:14px;align-items:flex-start">
        <div class="thumb" style="width:84px;height:84px;flex-shrink:0;background-image:url('${esc(p.image_url)}')"></div>
        <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p.name)}</b><b class="num">${inr0(p.total_price)}</b></div>
          <div class="sub"><code>${esc(p.sku)}</code> · <span style="text-transform:capitalize">${esc(p.category.replace('-', ' '))}</span>${p.tag ? ' · ' + esc(p.tag) : ''}</div>
          <div class="kv"><span>Weight</span><b>${g4(p.grams)}</b></div><div class="kv"><span>Purity</span><b>${esc(p.purity)} (${p.purity_pct}%)</b></div>
          <div class="kv"><span>Rate</span><b>${inr(p.buy_rate)}/g</b></div><div class="kv"><span>Metal value</span><b>${inr0(p.metal_value)}</b></div><div class="kv"><span>Making ${p.making_pct}%</span><b>${inr0(p.making_amount)}</b></div>
          ${p.description ? `<div class="sub" style="margin-top:6px">${esc(p.description)}</div>` : ''}</div></div>`).join('') : '<div class="empty"><b>No products</b>This shop has not added any products yet.</div>'}</div>`);
  } catch (e) { closeDrawer(); toast(e.message, true); }
}
async function mCustomer(id) {
  openDrawer('<div class="drawer-b"><div class="skeleton"></div></div>');
  try { const d = await api('/master/v3/customers/' + id); customerDrawer(d, true);
    const c = d.customer; S.mcust = c; if (c.kyc_status !== 'not_submitted') $('#drawer .drawer-b').insertAdjacentHTML('afterbegin', `<button class="btn" onclick="mKycOpen()">${icon('kyc')} View KYC details</button>`);
  } catch (e) { closeDrawer(); toast(e.message, true); }
}
function mKycOpen() { const c = S.mcust; kycDetails(c, `/master/v3/kyc/${c.id}/photo`, 'master_token'); }
function mKycView(id) {
  const c = S.mkyc.find((x) => x.id === id);
  kycDetails(c, `/master/v3/kyc/${id}/photo`, 'master_token', c.kyc_status === 'pending' ? `<button class="btn danger" onclick="closeModal();mKyc('${id}',false)">Reject</button><button class="btn primary" onclick="closeModal();mKyc('${id}',true)">Approve</button>` : '');
}

/* MT5 bookings */
const loadMt5 = () => safe(async () => { S.mt5 = await api('/master/v3/mt5-bookings'); }, 'mt5');
function vMt5() {
  const head = ph('MT5 Bookings', 'Every app purchase is added up. When the total reaches the minimum lot, a BUY order is placed on your MT5 account automatically.', `<button class="btn" onclick="mt5Positions()">${icon('eye')} Open positions</button> <button class="btn primary" onclick="mt5Retry()" id="mt5-retry">${icon('refresh')} Book now / retry</button>`);
  const m = S.mt5; if (!m) return head + loading; const c = m.config;
  const ok = m.bookings.filter((b) => b.status === 'booked'), bad = m.bookings.filter((b) => b.status === 'failed');
  return head + `${!m.configured ? '<div class="note">MT5 server link is not set, so orders cannot be placed.</div>' : ''}
    <div class="grid g4">${kpi('Gold waiting', g4(m.pending.gold), `books at ${g4(c.gold_lot_g * c.min_volume)} (${m.symbols.gold})`, 'coin')}${kpi('Silver waiting', g4(m.pending.silver), `books at ${g4(c.silver_lot_g * c.min_volume)} (${m.symbols.silver})`, 'coin', 'gray')}
      ${kpi('Orders booked', ok.length, g4(ok.reduce((a, b) => a + b.grams, 0)) + ' covered', 'orders', 'green')}${kpi('Failed attempts', bad.length, bad[0] ? esc(bad[0].error.slice(0, 60)) : 'none', 'shield', bad.length ? 'red' : '')}</div>
    <div class="card pad section"><div style="font-weight:600;margin-bottom:12px">Booking settings</div><div class="grid g4" style="align-items:end">
      <div class="field"><label>Gold: grams in 1 lot</label><input class="input num" id="m5g" type="number" step="0.01" min="0.01" value="${c.gold_lot_g}"></div>
      <div class="field"><label>Silver: grams in 1 lot</label><input class="input num" id="m5s" type="number" step="1" min="1" value="${c.silver_lot_g}"></div>
      <div class="field"><label>Smallest volume</label><input class="input num" id="m5v" type="number" step="0.01" min="0.01" value="${c.min_volume}"></div>
      <div class="field"><label>Volume step</label><input class="input num" id="m5t" type="number" step="0.01" min="0.01" value="${c.step}"></div>
      <div class="field"><label>Largest volume per order</label><input class="input num" id="m5x" type="number" step="0.01" min="0.01" value="${c.max_volume}"></div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="m5e" ${c.enabled ? 'checked' : ''}> Auto-booking on</label>
      <div><button class="btn primary" onclick="mt5Save()" id="mt5-save">Save settings</button></div></div></div>
    <div class="card section"><div class="table-wrap"><table><thead><tr><th>When</th><th>Metal</th><th>Symbol</th><th class="r">Volume</th><th class="r">Grams</th><th>Ticket</th><th>Status</th><th>Details</th></tr></thead><tbody>
    ${m.bookings.length ? m.bookings.map((b) => `<tr><td>${dt(b.created_at)}<div class="sub">${esc(b.trigger)}</div></td><td>${metalTag(b.metal)}</td><td><code>${esc(b.symbol)}</code></td><td class="r num">${b.volume}</td><td class="r num">${g4(b.grams)}</td><td><code>${esc(b.ticket || '—')}</code></td>
      <td>${b.status === 'booked' ? '<span class="badge green">Booked</span>' : '<span class="badge red">Failed</span>'}</td><td class="sub" style="max-width:320px">${esc(b.error || (b.price ? 'at ' + b.price : ''))}</td></tr>`).join('') : emptyRow(8, 'No MT5 orders yet')}</tbody></table></div></div>`;
}
async function mt5Save() { try { await api('/master/v3/mt5-bookings/config', { method: 'PUT', body: { enabled: $('#m5e').checked, gold_lot_g: Number($('#m5g').value), silver_lot_g: Number($('#m5s').value), min_volume: Number($('#m5v').value), step: Number($('#m5t').value), max_volume: Number($('#m5x').value) } }); toast('Saved'); loadMt5(); } catch (e) { toast(e.message, true); } }
async function mt5Retry() { const b = $('#mt5-retry'); b.disabled = true; try { const r = await api('/master/v3/mt5-bookings/retry', { method: 'POST' }); const v = Object.values(r.result); toast(v.includes(true) ? 'Order booked on MT5' : v.includes(false) ? 'MT5 refused the order — see details' : 'Not enough grams waiting for a full lot yet', v.includes(false)); loadMt5(); } catch (e) { toast(e.message, true); b.disabled = false; } }
async function mt5Positions() { try { const p = await api('/master/v3/mt5-positions'); openModal(`<div class="modal-h"><h3>Open MT5 positions</h3><button class="x" onclick="closeModal()">×</button></div><div class="modal-b">${Array.isArray(p) && p.length ? `<table><thead><tr><th>Ticket</th><th>Symbol</th><th>Type</th><th class="r">Volume</th><th class="r">Open price</th><th class="r">P/L</th></tr></thead><tbody>${p.map((x) => `<tr><td>${esc(x.ticket)}</td><td>${esc(x.symbol)}</td><td>${esc(x.type)}</td><td class="r">${x.volume}</td><td class="r">${x.price_open}</td><td class="r">${inr(x.profit)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No open positions</div>'}</div>`, true); } catch (e) { toast(e.message, true); } }

/* Shop dues (what each shop owes Master) */
const loadDues = () => safe(async () => { S.dues = await api('/master/v3/dues'); }, 'dues');
function vDues() {
  const head = ph('Shop Dues', 'Each shop pays Master the metal value + GST of every customer purchase and keeps its commission. Record payments here — the balance updates on the shop panel too.');
  const d = S.dues; if (!d) return head + loading; const t = d.totals;
  return head + `<div class="grid g4">${kpi('Total payable by shops', inr0(t.payable), `collected ${inr0(t.collected)} − commission ${inr0(t.commission)}`, 'wallet')}${kpi('Received', inr0(t.paid), 'all payments entered', 'check', 'green')}${kpi('Remaining to receive', inr0(t.remaining), 'across all shops', 'invoice', t.remaining > 0 ? 'red' : 'green')}${kpi('GST inside dues', inr0(t.gst), 'payable by Master', 'commission', 'blue')}</div>
    <div class="card section"><div class="table-wrap"><table><thead><tr><th>Shop</th><th class="r">Orders</th><th class="r">Collected</th><th class="r">Commission</th><th class="r">Payable</th><th class="r">Paid</th><th class="r">Remaining</th><th>Last paid</th><th></th></tr></thead><tbody>
    ${d.shops.map((x) => `<tr class="click" onclick="openDues('${x.id}')" data-dues="${x.id}"><td><b>${esc(x.shop)}</b></td><td class="r num">${x.orders}</td><td class="r num">${inr0(x.collected)}</td><td class="r num">${inr0(x.commission)}</td><td class="r num">${inr0(x.payable)}</td><td class="r num">${inr0(x.paid)}</td>
      <td class="r num"><b style="color:${x.remaining > 0 ? '#B42318' : 'inherit'}">${inr0(x.remaining)}</b></td><td>${esc(x.last_paid_on || '—')}</td><td class="r" onclick="event.stopPropagation()"><button class="btn sm primary" onclick="duesPayForm('${x.id}')" data-dues-pay="${x.id}">+ Record payment</button></td></tr>`).join('')}</tbody></table></div></div>`;
}
async function openDues(jid) {
  openDrawer('<div class="drawer-b"><div class="skeleton"></div></div>');
  try {
    const d = await api('/master/v3/dues/' + jid); S.duesOpen = jid;
    openDrawer(`<div class="drawer-h"><div style="flex:1"><h3 style="font-size:18px">${esc(d.summary.shop)} · Dues</h3><div style="font-size:13px;color:var(--mute)">Remaining ${inr(d.summary.remaining)}</div></div><button class="btn sm primary" onclick="duesPayForm('${jid}')">+ Record payment</button><button class="x" onclick="closeDrawer()">×</button></div>
      <div class="drawer-b" data-testid="dues-drawer">${duesDetail(d, true)}</div>`);
  } catch (e) { closeDrawer(); toast(e.message, true); }
}
function duesPayForm(jid) {
  const x = (S.dues?.shops || []).find((s) => s.id === jid) || {};
  openModal(`<div class="modal-h"><div><h3>Record payment</h3><p>${esc(x.shop || '')} · remaining ${inr(x.remaining || 0)}</p></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="modal-b" data-testid="dues-pay-modal"><div class="grid g2">
      <div class="field"><label>Amount received (₹)</label><input class="input num" id="dpa" type="number" min="1" step="0.01" value="${x.remaining > 0 ? x.remaining : ''}"></div>
      <div class="field"><label>Date</label><input class="input" id="dpd" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label>Reference / UTR</label><input class="input" id="dpr" maxlength="120" placeholder="e.g. UTR 4521…"></div>
      <div class="field"><label>Note</label><input class="input" id="dpn" maxlength="500" placeholder="optional"></div></div></div>
    <div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="dp-save" onclick="duesPay('${jid}')">Save payment</button></div>`);
}
async function duesPay(jid) {
  const amount = Number($('#dpa').value); if (!(amount > 0)) return toast('Enter the amount received', true);
  $('#dp-save').disabled = true;
  try {
    const r = await api(`/master/v3/dues/${jid}/payments`, { method: 'POST', body: { amount, paid_on: $('#dpd').value, reference: $('#dpr').value, note: $('#dpn').value } });
    closeModal(); toast(`Saved. Remaining ${inr(r.remaining)}`); await loadDues(); if (S.duesOpen === jid) openDues(jid);
  } catch (e) { toast(e.message, true); $('#dp-save').disabled = false; }
}
async function duesDelPay(pid) { if (!confirm('Remove this payment entry?')) return; try { await api('/master/v3/dues/payments/' + pid, { method: 'DELETE' }); toast('Payment removed'); await loadDues(); if (S.duesOpen) openDues(S.duesOpen); } catch (e) { toast(e.message, true); } }
