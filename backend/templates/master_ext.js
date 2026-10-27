const AUDIT_LABEL = { 'commission.update': 'Commission changed', 'pricing.update': 'Pricing changed', 'product.making': 'Making % changed', 'product.add': 'Product added', 'product.delete': 'Product removed', 'banner.add': 'Banner added', 'banner.delete': 'Banner removed', 'faq.add': 'FAQ added', 'faq.delete': 'FAQ removed', 'kyc.approved': 'KYC approved', 'kyc.rejected': 'KYC rejected' };
/* Master console: extra tabs */
const shopSel = (val, on) => `<select class="select" onchange="${on}"><option value="">All shops</option>${(S.jewellers || []).map((j) => `<option value="${j.id}" ${val === j.id ? 'selected' : ''}>${esc(j.business_name)}</option>`).join('')}</select>`;
const ph = (t, p, right = '') => `<div class="page-head"><div><h2>${t}</h2><p>${p}</p></div>${right}</div>`;
const needJ = async () => { if (!S.jewellers) S.jewellers = await api('/master/jewellers'); };

/* pricing */
const loadPricing = () => safe(async () => { S.pricing = await api('/master/v3/pricing'); S.price = S.pricing.price; }, 'pricing');
function vPricing() {
  const head = ph('Pricing', 'Each shop\'s commission on top of the live rate. Changes reach that shop\'s app instantly.');
  const p = S.pricing; if (!p) return head + loading;
  return head + `<div class="grid g2" style="margin-bottom:16px">
    <div class="card rate-card"><div class="coin"></div><div><div class="label"><span class="dot ${p.price.live ? 'live' : ''}"></span> Live gold</div><div class="value num">${inr(p.price.base_rate)} <small>/g</small></div></div></div>
    <div class="card rate-card"><div class="coin silver"></div><div><div class="label"><span class="dot ${p.price.live ? 'live' : ''}"></span> Live silver</div><div class="value num">${inr(p.price.silver.base_rate)} <small>/g</small></div></div></div></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Shop</th><th>Gold commission / g</th><th class="r">Gold buy rate</th><th>Silver commission / g</th><th class="r">Silver buy rate</th><th></th></tr></thead><tbody>
    ${p.shops.map((s) => `<tr><td><b>${esc(s.shop)}</b><div class="sub">${statusBadge(s.status)}</div></td>
      <td><div class="prefix" style="width:140px"><span>₹</span><input class="input num" type="number" min="0" max="1000" step="0.01" id="pg_${s.id}" value="${s.gold_commission_per_g}"></div></td><td class="r num"><b>${inr(s.gold_buy)}</b></td>
      <td><div class="prefix" style="width:140px"><span>₹</span><input class="input num" type="number" min="0" max="100" step="0.01" id="ps_${s.id}" value="${s.silver_commission_per_g}"></div></td><td class="r num"><b>${inr(s.silver_buy)}</b></td>
      <td class="r"><button class="btn sm primary" onclick="savePricing('${s.id}')">Save</button></td></tr>`).join('')}</tbody></table></div></div>`;
}
async function savePricing(id) { try { await api('/master/v3/pricing/' + id, { method: 'PUT', body: { gold_per_g: Number($('#pg_' + id).value || 0), silver_per_g: Number($('#ps_' + id).value || 0) } }); toast('Pricing updated'); loadPricing(); } catch (e) { toast(e.message, true); } }

/* catalogue */
S.catJ = '';
const loadMCat = () => safe(async () => { await needJ(); S.mcat = await api('/master/v3/catalogue?jeweller_id=' + S.catJ); }, 'catalogue');
function vMCatalogue() {
  const head = ph('Catalogue', 'Every product across all shops, priced at live rate + shop commission + making %.', shopSel(S.catJ, "S.catJ=this.value;loadMCat()"));
  const c = S.mcat; if (!c) return head + loading;
  return head + `<div class="card"><div class="table-wrap"><table><thead><tr><th>Image</th><th>Product</th><th>Shop</th><th class="r">Weight</th><th class="r">Rate / g</th><th class="r">Making</th><th class="r">Price</th><th></th></tr></thead><tbody>
    ${c.products.length ? c.products.map((p) => `<tr><td><div class="thumb" style="background-image:url('${esc(p.image_url)}')"></div></td><td><b>${esc(p.name)}</b><div class="sub"><code>${esc(p.sku)}</code></div></td><td>${esc(p.shop)}</td>
      <td class="r num">${g4(p.grams)}</td><td class="r num">${inr(p.buy_rate)}</td><td class="r num">${p.making_pct}%</td><td class="r num"><b>${inr0(p.total_price)}</b></td>
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
  return head + `<div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Shop</th><th>PAN</th><th>Status</th><th></th></tr></thead><tbody>
    ${k.length ? k.map((c) => `<tr><td><b>${esc(c.name)}</b><div class="sub">${phoneFmt(c.phone)}</div></td><td>${esc(c.shop)}</td><td><code>${esc((c.kyc || {}).pan || '—')}</code></td><td>${statusBadge(c.kyc_status)}</td>
      <td class="r" style="white-space:nowrap">${c.kyc_status === 'pending' ? `<button class="btn sm danger" onclick="mKyc('${c.id}',false)">Reject</button> <button class="btn sm primary" onclick="mKyc('${c.id}',true)">Approve</button>` : ''}</td></tr>`).join('') : emptyRow(5, 'Nothing here')}</tbody></table></div></div>`;
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
const vMGoals = () => ph('Gold Goals', 'What customers are saving towards.') + (S.mgoals ? goalsTable(S.mgoals, true) : loading);
const vAudit = () => tableView('Audit Log', 'Every important change made by shops and admins.', S.audit, ['When', 'By', 'Action', 'Target', 'Details'],
  (a) => `<tr><td>${dt(a.created_at)}</td><td><b>${esc(a.actor)}</b><div class="sub" style="text-transform:capitalize">${esc(a.actor_type)}</div></td><td><span class="badge gold plain">${esc(AUDIT_LABEL[a.action] || a.action.replace('.', ' · '))}</span></td><td>${esc(a.target)}</td><td class="sub">${esc(Object.entries(a.detail || {}).map(([k, v]) => k + ': ' + v).join(' · '))}</td></tr>`);
S.msf = { status: 'all', search: '' }; let msT;
const loadMSips = () => safe(async () => { S.msips = await api(`/master/v3/sips?status=${S.msf.status}&search=${encodeURIComponent(S.msf.search)}`); }, 'sips');
function mSipStatus(k) { S.msf.status = k; loadMSips(); }
function mSipSearch(v) { S.msf.search = v; clearTimeout(msT); msT = setTimeout(loadMSips, 300); }
const vMSips = () => ph('SIP', 'Systematic gold savings across every shop.') + (S.msips ? sipView(S.msips, S.msf, 'mSipStatus', 'mSipSearch', true) : loading);
