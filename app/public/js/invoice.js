// Invoice / statement templates and sharing as image or PDF (WhatsApp).
import { esc, fd, n2, qty, rs, rs2, words, nice, waPhone, loadScript, hud, fail, actionSheet, ic } from './core.js';

const KIND_TITLE = { sale: 'Sales Invoice', purchase: 'Purchase Invoice', sale_return: 'Sales Return', purchase_return: 'Purchase Return' };

const LOGO = '/brand/logo-full.png';
const coLines = c => [c.address, [c.phone && `Ph ${c.phone}`, c.email].filter(Boolean).join('  ·  '), [c.ntn && `NTN ${c.ntn}`, c.strn && `STRN ${c.strn}`].filter(Boolean).join('  ·  ')].filter(Boolean);
const head = (c, title, rows) => `
    <div class="ihead">
      <div class="ibrand"><img src="${LOGO}" alt="" crossorigin="anonymous"><div class="ico2"><b>${esc(c.name || 'Qayam Traders')}</b>${coLines(c).map(l => `<span>${esc(l)}</span>`).join('')}</div></div>
      <div class="ititle"><h2>${esc(title)}</h2><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</table></div>
    </div>
    <div class="ibar"><i></i></div>`;
const pre = t => esc(t || '').replace(/\n/g, '<br>');

// Discount figures for a bill: item discount (TP vs rate) + bill discount.
export function discountOf(d) {
  const { invoice: i, lines } = d;
  const L = lines.map(l => { const free = !(+l.rate > 0), tp = free ? 0 : Math.max(+l.tp || 0, +l.rate); return { ...l, free, tp, off: tp > +l.rate ? tp - +l.rate : 0 }; });
  const gross = L.reduce((a, l) => a + l.tp * +l.qty, 0);
  const item = L.reduce((a, l) => a + l.off * +l.qty, 0);
  const bill = +i.discount || 0;
  const total = item + bill;
  return { L, gross, item, bill, total, pct: gross > 0 ? total / gross * 100 : 0, show: item > 0.5 };
}
const pc = x => (x >= 10 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, '') + '%';

// opts.balance: print previous balance / total due (off by default; customers do not always want it on the bill)
export function invoiceHTML(d, { slip = false, balance = false } = {}) {
  const { invoice: i, party: p, company: c } = d;
  const tax = i.tax > 0, title = (tax && i.kind === 'sale') ? 'Sales Tax Invoice' : KIND_TITLE[i.kind];
  const due = Math.max(i.total - i.paid, 0);
  const payTxt = /return/.test(i.kind) ? (i.paid >= i.total - 0.5 ? 'Refunded' : 'Adjusted') : i.paid >= i.total - 0.5 ? 'Paid' : i.paid > 0 ? 'Partly paid' : 'Credit';
  const payCls = i.paid >= i.total - 0.5 ? 'ok' : i.paid > 0 ? 'part' : 'cr';
  const D = discountOf(d), lines = D.L;
  const totQty = lines.reduce((a, l) => a + (+l.qty || 0), 0);
  const cust = i.kind === 'sale' || i.kind === 'sale_return';
  const showAcct = balance && p?.kind === 'C' && cust;
  if (slip) {
    return `<div class="paper slip">
      <div class="c"><img src="${LOGO}" alt="" class="slogo"><br>${esc(c.address || '')}${c.phone ? '<br>Ph ' + esc(c.phone) : ''}${c.ntn ? '<br>NTN ' + esc(c.ntn) : ''}${c.strn ? ' STRN ' + esc(c.strn) : ''}</div><hr>
      <div class="c"><b>${esc(title.toUpperCase())}</b></div>
      <div class="r"><span>No.</span><span>${esc(i.no)}</span></div><div class="r"><span>Date</span><span>${esc(fd(i.date))}</span></div>
      <div class="r"><span>To</span><span>${esc(nice(p?.name))}</span></div><hr>
      ${lines.map((l, k) => `<div>${k + 1}. ${esc(nice(l.name))}</div>${l.off > 0 ? `<div class="r"><span>&nbsp;&nbsp;TP ${n2(l.tp)} - ${n2(l.off)} disc</span><span></span></div>` : ''}<div class="r"><span>&nbsp;&nbsp;${qty(l.qty)} ${esc(l.unit || '')} ${l.free ? 'FREE / sample' : 'x ' + n2(l.rate)}</span><span>${l.free ? '0.00' : n2(l.amount)}</span></div>`).join('')}<hr>
      <div class="r"><span>Items ${lines.length} · Qty ${qty(totQty)}</span><span></span></div>
      ${D.show ? `<div class="r"><span>Amount at TP</span><span>${n2(D.gross)}</span></div><div class="r"><span>Item discount</span><span>-${n2(D.item)}</span></div>` : `<div class="r"><span>Subtotal</span><span>${n2(i.subtotal)}</span></div>`}
      ${i.discount ? `<div class="r"><span>Bill discount</span><span>-${n2(i.discount)}</span></div>` : ''}
      ${tax ? `<div class="r"><span>Sales tax ${+i.tax_pct}%</span><span>${n2(i.tax)}</span></div>` : ''}
      <div class="r tot"><b class="big">TOTAL Rs</b><b class="big">${n2(i.total)}</b></div>
      ${D.total > 0.5 ? `<div class="c"><b>Total discount Rs ${n2(D.total)} (${pc(D.pct)})</b></div>` : ''}
      ${i.kind === 'sale' || i.kind === 'purchase' ? `<div class="r"><span>Received</span><span>${n2(i.paid)}</span></div>` : ''}
      ${showAcct ? `<div class="r"><span>Previous balance</span><span>${n2(d.previous)}</span></div><div class="r"><b>Total due</b><b>${n2(d.after)}</b></div>` : ''}<hr>
      <div class="c">${esc(c.footer || 'Thank you for your business')}</div></div>`;
  }
  return `<div class="paper inv">
    ${head(c, title.toUpperCase(), [['Invoice No.', `<b>${esc(i.no)}</b>`], ['Date', esc(fd(i.date))], ['Status', `<span class="st ${payCls}">${payTxt}</span>`]])}
    <div class="iparty">
      <div class="pbox"><small>${cust ? 'Bill to' : 'Supplier'}</small><b>${esc(nice(p?.name || ''))}</b>${p?.address || p?.city ? `<div>${esc([p.address, nice(p.city)].filter(Boolean).join(', '))}</div>` : ''}${p?.phone ? `<div>Ph ${esc(p.phone)}</div>` : ''}${p?.ntn ? `<div>NTN/CNIC ${esc(p.ntn)}</div>` : ''}</div>
      <div class="pbox r"><small>Details</small>
        ${i.ref_no ? `<div><span>Against invoice</span><b>${esc(i.ref_no)}</b></div>` : ''}
        <div><span>Prepared by</span><b>${esc(i.created_by_name || '—')}</b></div>
        <div><span>Items</span><b>${lines.length}</b></div>
        <div><span>Total qty</span><b>${qty(totQty)}</b></div>
        ${lines.some(l => l.free) ? `<div><span>Free / sample qty</span><b class="grn">${qty(lines.filter(l => l.free).reduce((a, l) => a + +l.qty, 0))}</b></div>` : ''}
        ${D.total > 0.5 ? `<div><span>Discount</span><b class="grn">Rs ${n2(D.total)}</b></div>` : ''}
      </div>
    </div>
    <table class="items"><thead><tr><th style="width:30px">#</th><th>Description</th><th class="n">Qty</th><th>Unit</th>${D.show ? '<th class="n">TP</th><th class="n">Disc</th><th class="n">Net rate</th>' : '<th class="n">Rate</th>'}<th class="n">Amount (Rs)</th></tr></thead>
      <tbody>${lines.map((l, k) => `<tr><td class="k">${k + 1}</td><td><b>${esc(nice(l.name || 'Item'))}</b>${l.free ? ' <span class="freeb">FREE · SAMPLE</span>' : ''}</td><td class="n">${qty(l.qty)}</td><td>${esc(l.unit || '')}</td>${D.show ? `<td class="n">${l.free ? '—' : n2(l.tp)}</td><td class="n">${l.off > 0 ? `<span class="grn">${n2(l.off)}</span><br><small class="dpc">${pc(l.off / l.tp * 100)}</small>` : '—'}</td>` : ''}<td class="n">${l.free ? '<b class="grn">FREE</b>' : n2(l.rate)}</td><td class="n">${l.free ? '0.00' : n2(l.amount)}</td></tr>`).join('')}</tbody></table>
    <div class="bottom">
      <div class="left">
        <div class="words"><small>Amount in words</small>${esc(words(i.total))}</div>
        ${D.total > 0.5 && i.kind === 'sale' ? `<div class="save"><small>Aap ki bachat · Your savings</small><b>Rs ${n2(D.total)}</b><span>${pc(D.pct)} off the trade price${D.item > 0.5 && D.bill > 0.5 ? ` (items ${n2(D.item)} + bill ${n2(D.bill)})` : ''}</span></div>` : ''}
        ${showAcct ? `<div class="acct"><small>Account summary</small><div><span>Previous balance</span><span>${rs2(d.previous)}</span></div><div><span>This ${i.kind === 'sale' ? 'bill' : 'credit note'}</span><span>${i.kind === 'sale' ? '+' : '-'}${rs2(i.total)}</span></div><div><span>Received now</span><span>-${rs2(i.paid)}</span></div><div class="tdue"><span>Total balance due</span><span>${rs2(d.after)}</span></div></div>` : ''}
        ${i.note && !/^Voice:/.test(i.note) ? `<div class="note"><small>Note</small>${esc(i.note)}</div>` : ''}
      </div>
      <table class="totals">
        ${D.show ? `<tr><td>Amount at TP</td><td>${n2(D.gross)}</td></tr><tr class="dsc"><td>Item discount</td><td>-${n2(D.item)}</td></tr>` : `<tr><td>Subtotal</td><td>${n2(i.subtotal)}</td></tr>`}
        ${i.discount ? `<tr class="dsc"><td>Bill discount</td><td>-${n2(i.discount)}</td></tr>` : ''}
        ${D.show && i.discount ? `<tr class="dsc tdsc"><td>Total discount</td><td>-${n2(D.total)}</td></tr>` : ''}
        ${tax ? `<tr><td>Sales tax ${+i.tax_pct}%</td><td>${n2(i.tax)}</td></tr>` : ''}
        <tr class="grand"><td>Grand total</td><td>Rs ${n2(i.total)}</td></tr>
        ${i.kind === 'sale' || i.kind === 'purchase' ? `<tr><td>${i.kind === 'sale' ? 'Received' : 'Paid'}</td><td>${n2(i.paid)}</td></tr>${due > 0.5 ? `<tr class="due"><td>Balance on this bill</td><td>${n2(due)}</td></tr>` : ''}` : ''}
      </table>
    </div>
    ${c.bank || c.terms ? `<div class="iinfo">${c.bank ? `<div><small>Bank details</small>${pre(c.bank)}</div>` : ''}${c.terms ? `<div><small>Terms &amp; conditions</small>${pre(c.terms)}</div>` : ''}</div>` : ''}
    <div class="signs"><div>Received by</div><div>For ${esc(c.name || 'Qayam Traders')}<br><span>Authorised signature</span></div></div>
    <div class="ifoot"><span>${esc(c.footer || 'Thank you for your business.')}</span><span>Computer generated · no signature required</span></div>
  </div>`;
}

// Proper ledger (A4): Date | Voucher | Particulars | Debit | Credit | Balance Dr/Cr — used for party statements and every account ledger.
// d: { opening, lines[{date,no,memo,type,debit,credit,balance}], closing, from, to, company }; flip: balances are stored the other way round (suppliers)
const drcr = (b, flip) => { const v = flip ? -b : b; return `${n2(Math.abs(v))} ${Math.abs(v) < 0.005 ? '' : v > 0 ? 'Dr' : 'Cr'}`; };
export function ledgerHTML(d, { title = 'ACCOUNT LEDGER', who = '', whoLabel = 'Account', whoLines = [], flip = false, note = '' } = {}) {
  const c = d.company || {};
  const dr = d.lines.reduce((a, l) => a + (+l.debit || 0), 0), cr = d.lines.reduce((a, l) => a + (+l.credit || 0), 0);
  return `<div class="paper inv led">
    ${head(c, title, [['From', esc(fd(d.from))], ['To', esc(fd(d.to))], ['Entries', String(d.lines.length)]])}
    <div class="iparty">
      <div class="pbox"><small>${esc(whoLabel)}</small><b>${esc(nice(who))}</b>${whoLines.map(x => `<div>${esc(x)}</div>`).join('')}</div>
      <div class="pbox r"><small>Summary</small>
        <div><span>Opening balance</span><b>${drcr(d.opening, flip)}</b></div><div><span>Total debit</span><b>${n2(dr)}</b></div><div><span>Total credit</span><b>${n2(cr)}</b></div>
        <div><span>Closing balance</span><b class="red">${drcr(d.closing, flip)}</b></div></div>
    </div>
    <table class="items ledt"><thead><tr><th style="width:92px">Date</th><th style="width:118px">Voucher</th><th>Particulars</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead><tbody>
      <tr class="ob"><td>${esc(fd(d.from))}</td><td></td><td><b>Opening balance</b></td><td class="n"></td><td class="n"></td><td class="n"><b>${drcr(d.opening, flip)}</b></td></tr>
      ${d.lines.map(l => `<tr><td>${esc(fd(l.date))}</td><td>${esc(l.no || '')}</td><td>${esc(shortMemo(l))}</td><td class="n">${+l.debit ? n2(l.debit) : ''}</td><td class="n">${+l.credit ? n2(l.credit) : ''}</td><td class="n">${drcr(l.balance, flip)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="3"><b>Total</b></td><td class="n"><b>${n2(dr)}</b></td><td class="n"><b>${n2(cr)}</b></td><td class="n"><b>${drcr(d.closing, flip)}</b></td></tr></tfoot></table>
    <div class="bottom"><div class="left"><div class="words"><small>Closing balance in words</small>${esc(words(Math.abs(d.closing)))}</div>${note ? `<div class="note">${esc(note)}</div>` : ''}</div>
      <table class="totals"><tr class="grand"><td>Closing balance</td><td>Rs ${drcr(d.closing, flip)}</td></tr></table></div>
    ${c.bank ? `<div class="iinfo"><div><small>Bank details</small>${pre(c.bank)}</div></div>` : ''}
    <div class="ifoot"><span>${esc(c.footer || 'Thank you for your business.')}</span><span>Computer generated ledger</span></div></div>`;
}
export function statementHTML(d) {
  const p = d.party, cust = p.kind === 'C';
  // the server sends supplier balances as "you owe" (positive): show them as Cr
  return ledgerHTML(d, { title: 'ACCOUNT STATEMENT', who: p.name, whoLabel: cust ? 'Customer' : 'Supplier', whoLines: [nice(p.city || ''), p.phone ? 'Ph ' + p.phone : ''].filter(Boolean), flip: !cust,
    note: cust ? (d.closing > 0 ? 'Dr = amount the customer owes us.' : '') : (d.closing > 0 ? 'Cr = amount we owe the supplier.' : '') });
}
const shortMemo = l => { const m = String(l.memo || l.type || ''); return m.length > 70 ? m.slice(0, 68) + '…' : m; };

// Scale the 794 px paper to the phone's width
export function fitPaper(wrap) {
  const paper = wrap.querySelector('.paper'); if (!paper) return;
  const fit = () => { const w = wrap.clientWidth, pw = paper.offsetWidth, s = Math.min(1, w / pw); paper.style.transform = `scale(${s})`; wrap.style.height = paper.offsetHeight * s + 'px'; };
  fit(); new ResizeObserver(fit).observe(wrap);
}

async function canvasOf(html) {
  await loadScript('/vendor/html2canvas.min.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff';
  host.innerHTML = html; document.body.append(host);
  await Promise.all([...host.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  try { return await window.html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true }); }
  finally { host.remove(); }
}
const canvasBlob = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));
async function pdfBlob(cv) {
  await loadScript('/vendor/jspdf.umd.min.js');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
  const imgH = cv.height * W / cv.width, img = cv.toDataURL('image/jpeg', 0.92);
  let y = 0;
  while (y < imgH - 1) { if (y > 0) pdf.addPage(); pdf.addImage(img, 'JPEG', 0, -y, W, imgH); y += H; }
  return pdf.output('blob');
}
const b64 = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });

export async function shareFile(blob, filename, text) {
  const Cap = window.Capacitor;
  if (Cap?.isNativePlatform?.() && Cap.Plugins?.Filesystem && Cap.Plugins?.Share) {
    const { uri } = await Cap.Plugins.Filesystem.writeFile({ path: filename, data: await b64(blob), directory: 'CACHE' });
    await Cap.Plugins.Share.share({ title: filename, text, files: [uri], dialogTitle: 'Send' });
    return;
  }
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename, text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  hud('Downloaded. WhatsApp mein attach karein.', 'info', 2200);
}

// Open a file on the phone (PDF viewer / gallery) or in a new browser tab.
export async function openFile(blob, filename, mime) {
  const Cap = window.Capacitor;
  if (Cap?.isNativePlatform?.() && Cap.Plugins?.Filesystem) {
    const { uri } = await Cap.Plugins.Filesystem.writeFile({ path: filename, data: await b64(blob), directory: 'CACHE' });
    const FO = Cap.Plugins.FileOpener;
    if (FO) { try { await FO.open({ filePath: uri, contentType: mime, openWithDefault: true }); return; } catch (e) { /* no viewer app: fall back to share */ } }
    if (Cap.Plugins.Share) { await Cap.Plugins.Share.share({ title: filename, files: [uri], dialogTitle: 'Open with' }); return; }
  }
  const u = URL.createObjectURL(blob);
  const w = open(u, '_blank');
  if (!w) { const a = document.createElement('a'); a.href = u; a.download = filename; document.body.append(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

// In-app viewer: the document as a picture you can zoom, with Open PDF / Image / Send / Print.
export async function viewDoc(html, { name, phone, text, title }) {
  const ov = document.createElement('div'); ov.className = 'docview';
  ov.innerHTML = `<div class="dv-bar"><button class="dv-x" data-x aria-label="Close">${ic('x')}</button><b>${esc(title || name)}</b><span class="sp"></span><button data-zo aria-label="Zoom out">−</button><button data-zi aria-label="Zoom in">+</button></div>
    <div class="dv-body"><div class="loading"><span class="spin"></span></div></div>
    <div class="dv-actions"><button data-pdf>${ic('pdf')}<span>PDF</span></button><button data-img>${ic('image')}<span>Image</span></button><button data-send>${ic('share')}<span>Send</span></button><button data-print>${ic('printer')}<span>Print</span></button></div>`;
  document.body.append(ov); document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); document.body.style.overflow = ''; removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') close(); }; addEventListener('keydown', esc_);
  let cv = null, zoom = 1;
  const body = ov.querySelector('.dv-body');
  const setZoom = z => { zoom = Math.min(Math.max(z, 1), 3.5); const im = body.querySelector('img'); if (im) im.style.width = (zoom * 100) + '%'; };
  ov.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x !== undefined) return close();
    if (b.dataset.zi !== undefined) return setZoom(zoom + 0.5);
    if (b.dataset.zo !== undefined) return setZoom(zoom - 0.5);
    if (!cv) return;
    try {
      if (b.dataset.pdf !== undefined) { hud('PDF khul raha hai…', 'info', 900); await openFile(await pdfBlob(cv), `${name}.pdf`, 'application/pdf'); }
      if (b.dataset.img !== undefined) await openFile(await canvasBlob(cv, 'image/jpeg', 0.92), `${name}.jpg`, 'image/jpeg');
      if (b.dataset.send !== undefined) shareDoc(html, { name, phone, text });
      if (b.dataset.print !== undefined) printHTML(html);
    } catch (x) { fail(x); }
  };
  body.addEventListener('dblclick', () => setZoom(zoom > 1 ? 1 : 2));
  try { cv = await canvasOf(html); body.innerHTML = `<img alt="" src="${cv.toDataURL('image/jpeg', 0.9)}">`; } catch (x) { fail(x); close(); }
}

export async function shareDoc(html, { name, phone, text }) {
  const how = await actionSheet('Send to customer', [
    { label: 'Send as PDF', icon: 'pdf', value: 'pdf' },
    { label: 'Send as picture', icon: 'image', value: 'png' },
    ...(waPhone(phone) ? [{ label: 'WhatsApp message (text)', icon: 'chat', value: 'wa' }] : []),
    { label: 'Print', icon: 'printer', value: 'print' },
  ]);
  if (!how) return;
  try {
    if (how === 'wa') { open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`, '_blank'); return; }
    if (how === 'print') { printHTML(html); return; }
    hud('Tayyar ho raha hai…', 'info', 900);
    const cv = await canvasOf(html);
    const blob = how === 'pdf' ? await pdfBlob(cv) : await canvasBlob(cv, 'image/png');
    await shareFile(blob, `${name}.${how}`, text);
  } catch (e) { fail(e); }
}

function printHTML(html) {
  const w = open('', '_blank');
  if (!w) return hud('Popup blocked', 'err');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print</title><link rel="stylesheet" href="/app.css"><style>body{background:#fff}.paper{transform:none!important}</style></head><body>${html}<script>setTimeout(()=>{print()},400)<\/script></body></html>`);
  w.document.close();
}

export const billText = (d, { balance = false } = {}) => {
  const i = d.invoice, D = discountOf(d);
  return `Assalam-o-Alaikum ${nice(d.party?.name || '')},\n${KIND_TITLE[i.kind]} ${i.no} (${fd(i.date)})\n` +
    d.lines.map(l => (+l.rate > 0 ? `• ${nice(l.name)}: ${qty(l.qty)} ${l.unit || ''} x ${rs(l.rate)} = ${rs(l.amount)}` : `• ${nice(l.name)}: ${qty(l.qty)} ${l.unit || ''} FREE (sample)`)).join('\n') +
    `\n${D.total > 0.5 ? `Discount: ${rs(D.total)} (${pc(D.pct)})\n` : ''}*Total: ${rs(i.total)}*${i.paid > 0 ? `\nReceived: ${rs(i.paid)}` : ''}` +
    `${balance && d.party?.kind === 'C' ? `\nPrevious balance: ${rs(d.previous)}\nTotal balance due: ${rs(d.after)}` : ''}\n\n${d.company.name}${d.company.phone ? '\n' + d.company.phone : ''}`;
};
