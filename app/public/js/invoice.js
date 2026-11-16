// Invoice / statement templates and sharing as image or PDF (WhatsApp).
import { esc, fd, n2, qty, rs, rs2, words, nice, waPhone, loadScript, hud, fail, actionSheet, ic } from './core.js';

const KIND_TITLE = { sale: 'Sales Invoice', purchase: 'Purchase Bill', sale_return: 'Credit Note', purchase_return: 'Debit Note' };

const LOGO = '/brand/logo-full.png';
const coLines = c => [c.address, [c.phone && `Ph ${c.phone}`, c.email].filter(Boolean).join('  ·  '), [c.ntn && `NTN ${c.ntn}`, c.strn && `STRN ${c.strn}`].filter(Boolean).join('  ·  ')].filter(Boolean);
const head = (c, title, rows) => `
    <div class="ihead">
      <div class="ibrand"><img src="${LOGO}" alt="" crossorigin="anonymous"><div class="ico2"><b>${esc(c.name || 'Qayam Traders')}</b>${coLines(c).map(l => `<span>${esc(l)}</span>`).join('')}</div></div>
      <div class="ititle"><h2>${esc(title)}</h2><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</table></div>
    </div>
    <div class="ibar"><i></i></div>`;
const pre = t => esc(t || '').replace(/\n/g, '<br>');

export function invoiceHTML(d, { slip = false } = {}) {
  const { invoice: i, lines, party: p, company: c } = d;
  const tax = i.tax > 0, title = (tax && i.kind === 'sale') ? 'Sales Tax Invoice' : KIND_TITLE[i.kind];
  const due = Math.max(i.total - i.paid, 0);
  const payTxt = i.paid >= i.total - 0.5 ? 'Paid' : i.paid > 0 ? 'Partly paid' : 'Credit';
  const payCls = i.paid >= i.total - 0.5 ? 'ok' : i.paid > 0 ? 'part' : 'cr';
  const totQty = lines.reduce((a, l) => a + (+l.qty || 0), 0);
  const cust = i.kind === 'sale' || i.kind === 'sale_return';
  const showAcct = p?.kind === 'C' && cust;
  if (slip) {
    return `<div class="paper slip">
      <div class="c"><img src="${LOGO}" alt="" class="slogo"><br>${esc(c.address || '')}${c.phone ? '<br>Ph ' + esc(c.phone) : ''}${c.ntn ? '<br>NTN ' + esc(c.ntn) : ''}${c.strn ? ' STRN ' + esc(c.strn) : ''}</div><hr>
      <div class="c"><b>${esc(title.toUpperCase())}</b></div>
      <div class="r"><span>No.</span><span>${esc(i.no)}</span></div><div class="r"><span>Date</span><span>${esc(fd(i.date))}</span></div>
      <div class="r"><span>To</span><span>${esc(nice(p?.name))}</span></div><hr>
      ${lines.map((l, k) => `<div>${k + 1}. ${esc(nice(l.name))}</div><div class="r"><span>&nbsp;&nbsp;${qty(l.qty)} ${esc(l.unit || '')} x ${n2(l.rate)}</span><span>${n2(l.amount)}</span></div>`).join('')}<hr>
      <div class="r"><span>Items ${lines.length} · Qty ${qty(totQty)}</span><span></span></div>
      <div class="r"><span>Subtotal</span><span>${n2(i.subtotal)}</span></div>
      ${i.discount ? `<div class="r"><span>Discount</span><span>-${n2(i.discount)}</span></div>` : ''}
      ${tax ? `<div class="r"><span>Sales tax ${+i.tax_pct}%</span><span>${n2(i.tax)}</span></div>` : ''}
      <div class="r tot"><b class="big">TOTAL Rs</b><b class="big">${n2(i.total)}</b></div>
      <div class="r"><span>Received</span><span>${n2(i.paid)}</span></div>
      ${showAcct ? `<div class="r"><span>Previous balance</span><span>${n2(d.previous)}</span></div><div class="r"><b>Total due</b><b>${n2(d.after)}</b></div>` : ''}<hr>
      <div class="c">${esc(c.footer || 'Thank you for your business')}</div></div>`;
  }
  return `<div class="paper inv">
    ${head(c, title.toUpperCase(), [['Invoice No.', `<b>${esc(i.no)}</b>`], ['Date', esc(fd(i.date))], ['Status', `<span class="st ${payCls}">${payTxt}</span>`]])}
    <div class="iparty">
      <div class="pbox"><small>${cust ? 'Bill to' : 'Supplier'}</small><b>${esc(nice(p?.name || ''))}</b>${p?.address || p?.city ? `<div>${esc([p.address, nice(p.city)].filter(Boolean).join(', '))}</div>` : ''}${p?.phone ? `<div>Ph ${esc(p.phone)}</div>` : ''}${p?.ntn ? `<div>NTN/CNIC ${esc(p.ntn)}</div>` : ''}</div>
      <div class="pbox r"><small>Details</small>
        <div><span>Prepared by</span><b>${esc(i.created_by_name || '—')}</b></div>
        <div><span>Items</span><b>${lines.length}</b></div>
        <div><span>Total qty</span><b>${qty(totQty)}</b></div>
        ${due > 0.5 && i.kind === 'sale' ? `<div><span>Balance on bill</span><b class="red">Rs ${n2(due)}</b></div>` : ''}
      </div>
    </div>
    <table class="items"><thead><tr><th style="width:34px">#</th><th>Description</th><th class="n">Qty</th><th>Unit</th><th class="n">Rate</th><th class="n">Amount (Rs)</th></tr></thead>
      <tbody>${lines.map((l, k) => `<tr><td class="k">${k + 1}</td><td><b>${esc(nice(l.name || 'Item'))}</b></td><td class="n">${qty(l.qty)}</td><td>${esc(l.unit || '')}</td><td class="n">${n2(l.rate)}</td><td class="n">${n2(l.amount)}</td></tr>`).join('')}</tbody></table>
    <div class="bottom">
      <div class="left">
        <div class="words"><small>Amount in words</small>${esc(words(i.total))}</div>
        ${showAcct ? `<div class="acct"><small>Account summary</small><div><span>Previous balance</span><span>${rs2(d.previous)}</span></div><div><span>This ${i.kind === 'sale' ? 'bill' : 'credit note'}</span><span>${i.kind === 'sale' ? '+' : '-'}${rs2(i.total)}</span></div><div><span>Received now</span><span>-${rs2(i.paid)}</span></div><div class="tdue"><span>Total balance due</span><span>${rs2(d.after)}</span></div></div>` : ''}
        ${i.note && !/^Voice:/.test(i.note) ? `<div class="note"><small>Note</small>${esc(i.note)}</div>` : ''}
      </div>
      <table class="totals">
        <tr><td>Subtotal</td><td>${n2(i.subtotal)}</td></tr>
        ${i.discount ? `<tr><td>Discount</td><td>-${n2(i.discount)}</td></tr>` : ''}
        ${tax ? `<tr><td>Sales tax ${+i.tax_pct}%</td><td>${n2(i.tax)}</td></tr>` : ''}
        <tr class="grand"><td>Grand total</td><td>Rs ${n2(i.total)}</td></tr>
        ${i.kind === 'sale' || i.kind === 'purchase' ? `<tr><td>${i.kind === 'sale' ? 'Received' : 'Paid'}</td><td>${n2(i.paid)}</td></tr>${due > 0.5 ? `<tr class="due"><td>Balance</td><td>${n2(due)}</td></tr>` : ''}` : ''}
      </table>
    </div>
    ${c.bank || c.terms ? `<div class="iinfo">${c.bank ? `<div><small>Bank details</small>${pre(c.bank)}</div>` : ''}${c.terms ? `<div><small>Terms &amp; conditions</small>${pre(c.terms)}</div>` : ''}</div>` : ''}
    <div class="signs"><div>Received by</div><div>For ${esc(c.name || 'Qayam Traders')}<br><span>Authorised signature</span></div></div>
    <div class="ifoot"><span>${esc(c.footer || 'Thank you for your business.')}</span><span>Computer generated · no signature required</span></div>
  </div>`;
}

export function statementHTML(d) {
  const { party: p, company: c } = d;
  const cust = p.kind === 'C';
  const dr = d.lines.reduce((a, l) => a + (+l.debit || 0), 0), cr = d.lines.reduce((a, l) => a + (+l.credit || 0), 0);
  return `<div class="paper inv">
    ${head(c, 'ACCOUNT STATEMENT', [['From', esc(fd(d.from))], ['To', esc(fd(d.to))], ['Entries', String(d.lines.length)]])}
    <div class="iparty">
      <div class="pbox"><small>${cust ? 'Customer' : 'Supplier'}</small><b>${esc(nice(p.name))}</b>${p.city ? `<div>${esc(nice(p.city))}</div>` : ''}${p.phone ? `<div>Ph ${esc(p.phone)}</div>` : ''}</div>
      <div class="pbox r"><small>Summary</small>
        <div><span>Opening</span><b>${n2(d.opening)}</b></div><div><span>Debit</span><b>${n2(dr)}</b></div><div><span>Credit</span><b>${n2(cr)}</b></div>
        <div><span>Balance ${cust ? 'due' : 'payable'}</span><b class="red">Rs ${n2(d.closing)}</b></div></div>
    </div>
    <table class="items"><thead><tr><th>Date</th><th>Ref</th><th>Details</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead><tbody>
      <tr><td>${esc(fd(d.from))}</td><td></td><td><b>Opening balance</b></td><td class="n"></td><td class="n"></td><td class="n">${n2(d.opening)}</td></tr>
      ${d.lines.map(l => `<tr><td>${esc(fd(l.date))}</td><td>${esc(l.no)}</td><td>${esc(shortMemo(l))}</td><td class="n">${l.debit ? n2(l.debit) : ''}</td><td class="n">${l.credit ? n2(l.credit) : ''}</td><td class="n">${n2(l.balance)}</td></tr>`).join('')}
    </tbody></table>
    <div class="bottom"><div class="left"><div class="words"><small>Closing balance in words</small>${esc(words(d.closing))}</div></div>
      <table class="totals"><tr class="grand"><td>Closing balance</td><td>Rs ${n2(d.closing)}</td></tr></table></div>
    ${c.bank ? `<div class="iinfo"><div><small>Bank details</small>${pre(c.bank)}</div></div>` : ''}
    <div class="ifoot"><span>${esc(c.footer || 'Thank you for your business.')}</span><span>Computer generated statement</span></div></div>`;
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

async function shareFile(blob, filename, text) {
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

export const billText = d => {
  const i = d.invoice;
  return `Assalam-o-Alaikum ${nice(d.party?.name || '')},\n${KIND_TITLE[i.kind]} ${i.no} (${fd(i.date)})\nTotal: ${rs(i.total)}\nReceived: ${rs(i.paid)}${d.party?.kind === 'C' ? `\nTotal balance due: ${rs(d.after)}` : ''}\n\n${d.company.name}${d.company.phone ? '\n' + d.company.phone : ''}`;
};
