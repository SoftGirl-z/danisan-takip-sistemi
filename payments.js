// ============================================================
// payments.js — Profesyonel Makbuz & Taksit (HTML Print PDF)
// ============================================================

// ─── TAKSİT PLANI MODAL ─────────────────────────────────────

function openInstallmentModal(packageId) {
    const pkg    = (window.packagesData || packages).find(p => p.id === packageId);
    const client = pkg ? (window.clientsData || clients).find(c => c.id === pkg.clientId) : null;
    if (!pkg || !client) return;

    const existing = document.getElementById('installmentModal');
    if (existing) existing.remove();

    const remaining    = (pkg.price || 0) - (pkg.paidAmount || 0);
    const defaultCount = remaining > 2000 ? 4 : remaining > 1000 ? 3 : 2;

    const modal = document.createElement('div');
    modal.id = 'installmentModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📅 Taksit Planı</h3>
                <button class="close-btn" onclick="document.getElementById('installmentModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="payment-info-box">
                    <strong>${client.name}</strong> — ${pkg.name}<br>
                    <span style="color:var(--stone); font-size:13px;">
                        Toplam: ${pkg.price.toFixed(0)} ₺ &nbsp;|&nbsp;
                        Ödenen: ${(pkg.paidAmount||0).toFixed(0)} ₺ &nbsp;|&nbsp;
                        <span style="color:var(--danger);">Kalan: ${remaining.toFixed(0)} ₺</span>
                    </span>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Taksit Sayısı</label>
                        <select id="installCount" onchange="previewInstallments('${packageId}')">
                            <option value="2" ${defaultCount===2?'selected':''}>2 Taksit</option>
                            <option value="3" ${defaultCount===3?'selected':''}>3 Taksit</option>
                            <option value="4" ${defaultCount===4?'selected':''}>4 Taksit</option>
                            <option value="6">6 Taksit</option>
                            <option value="12">12 Taksit</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>İlk Taksit Tarihi</label>
                        <input type="date" id="installStartDate" value="${todayStr()}"
                            onchange="previewInstallments('${packageId}')">
                    </div>
                </div>
                <div id="installmentPreview"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="printInstallmentPDF('${packageId}')">
                    🖨️ PDF Olarak Kaydet
                </button>
                <button class="btn btn-secondary" onclick="document.getElementById('installmentModal').remove()">Kapat</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    previewInstallments(packageId);
}

function previewInstallments(packageId) {
    const pkg       = (window.packagesData || packages).find(p => p.id === packageId);
    if (!pkg) return;
    const remaining = (pkg.price || 0) - (pkg.paidAmount || 0);
    const count     = parseInt(document.getElementById('installCount')?.value || 2);
    const startDate = document.getElementById('installStartDate')?.value;
    if (!startDate) return;

    const perInstall = remaining / count;
    const preview    = document.getElementById('installmentPreview');
    if (!preview) return;

    let rows = '';
    for (let i = 0; i < count; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        rows += `
        <tr>
            <td style="padding:11px 14px; border-bottom:1px solid var(--border-soft); font-weight:600;">${i+1}. Taksit</td>
            <td style="padding:11px 14px; border-bottom:1px solid var(--border-soft); color:var(--stone);">
                ${d.toLocaleDateString('tr-TR', {day:'numeric', month:'long', year:'numeric'})}
            </td>
            <td style="padding:11px 14px; border-bottom:1px solid var(--border-soft); text-align:right;">
                <strong style="color:var(--sage-dark);">${perInstall.toFixed(0)} ₺</strong>
            </td>
        </tr>`;
    }

    preview.innerHTML = `
        <table style="width:100%; border-collapse:collapse; background:var(--surface-2); border-radius:var(--r-md); overflow:hidden; margin-top:4px;">
            <thead>
                <tr style="background:linear-gradient(135deg,var(--sage) 0%,var(--sage-dark) 100%);">
                    <th style="padding:10px 14px; text-align:left; font-size:12px; color:white; font-weight:600;">Taksit</th>
                    <th style="padding:10px 14px; text-align:left; font-size:12px; color:white; font-weight:600;">Tarih</th>
                    <th style="padding:10px 14px; text-align:right; font-size:12px; color:white; font-weight:600;">Tutar</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:var(--surface-3);">
                    <td colspan="2" style="padding:11px 14px; font-weight:700; color:var(--ink);">Toplam Kalan</td>
                    <td style="padding:11px 14px; font-weight:700; color:var(--sage-dark); text-align:right;">${remaining.toFixed(0)} ₺</td>
                </tr>
            </tfoot>
        </table>`;
}

// ─── HTML PRINT PDF — TAKSİT PLANI ──────────────────────────

function printInstallmentPDF(packageId) {
    const pkg    = (window.packagesData || packages).find(p => p.id === packageId);
    const client = pkg ? (window.clientsData || clients).find(c => c.id === pkg.clientId) : null;
    if (!pkg || !client) return;

    const count      = parseInt(document.getElementById('installCount')?.value || 2);
    const startDate  = document.getElementById('installStartDate')?.value || todayStr();
    const remaining  = (pkg.price || 0) - (pkg.paidAmount || 0);
    const perInstall = remaining / count;
    const profile    = window._currentProfile || {};
    const bizName    = profile.businessName || 'Studio';
    const bizTagline = profile.tagline  || '';
    const bizPhone   = profile.phone    || '';
    const bizAddress = profile.address  || '';

    let rows = '';
    for (let i = 0; i < count; i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        const bg = i % 2 === 0 ? '#faf8f5' : '#ffffff';
        rows += `
        <tr style="background:${bg};">
            <td style="padding:13px 18px; border-bottom:1px solid #ede8e2; font-weight:600; color:#2d3340;">${i+1}. Taksit</td>
            <td style="padding:13px 18px; border-bottom:1px solid #ede8e2; color:#6b7280;">
                ${d.toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}
            </td>
            <td style="padding:13px 18px; border-bottom:1px solid #ede8e2; text-align:right; font-weight:700; font-size:16px; color:#5f8076;">
                ${perInstall.toFixed(2)} ₺
            </td>
            <td style="padding:13px 18px; border-bottom:1px solid #ede8e2; text-align:center;">
                <span style="display:inline-block; padding:4px 12px; background:#f1ede8; border-radius:20px;
                    font-size:11px; font-weight:600; color:#9a8878; letter-spacing:.03em;">Bekliyor</span>
            </td>
        </tr>`;
    }

    const html = buildPrintHTML('taksit', {
        bizName, bizTagline, bizPhone, bizAddress, client, pkg,
        remaining, perInstall, count, startDate, rows
    });

    openPrintWindow(html, 900, 700);
}

// ─── HTML PRINT PDF — MAKBUZ ─────────────────────────────────

function generateReceiptPDF(payment, client, pkg) {
    const profile    = window._currentProfile || {};
    const bizName    = profile.businessName || 'Studio';
    const bizTagline = profile.tagline  || '';
    const bizPhone   = profile.phone    || '';
    const bizAddress = profile.address  || '';
    const receiptNo  = 'MKB-' + Date.now().toString().slice(-6);

    const html = buildPrintHTML('makbuz', {
        bizName, bizTagline, bizPhone, bizAddress,
        client, pkg, payment, receiptNo
    });

    openPrintWindow(html, 680, 600);
}

// ─── HTML BUILDER ────────────────────────────────────────────

function buildPrintHTML(type, d) {
    const fontImport = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');`;

    const baseStyle = `
        ${fontImport}
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'DM Sans',system-ui,sans-serif; background:#f5f3f0;
               color:#2d3340; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        @media print { body { background:white; } .no-print { display:none !important; } }`;

    const printBar = (width) => `
        <div class="no-print" style="text-align:center; padding:16px; background:#f0ede8; border-top:1px solid #ddd8d2;">
            <button onclick="window.print()" style="padding:11px 28px; background:#5f8076; color:white;
                border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; margin-right:8px;">
                🖨️ PDF Kaydet / Yazdır
            </button>
            <button onclick="window.close()" style="padding:11px 20px; background:#e8e2db; color:#2d3340;
                border:none; border-radius:8px; font-size:14px; cursor:pointer;">
                Kapat
            </button>
        </div>`;

    if (type === 'taksit') {
        const pageStyle = `@page { margin:0; size:A4; }`;
        return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Taksit Planı — ${d.client.name}</title>
<style>${baseStyle} ${pageStyle}</style></head><body>
<div style="max-width:794px; margin:0 auto; background:white; min-height:1123px; position:relative;">

  <!-- Header gradient -->
  <div style="background:linear-gradient(135deg,#8fada1 0%,#5f8076 100%); padding:40px 50px 36px; display:flex; justify-content:space-between; align-items:flex-start;">
    <div>
      <div style="font-family:'Playfair Display',serif; font-size:28px; font-weight:600; color:white; letter-spacing:-.02em;">${d.bizName}</div>
      ${d.bizTagline ? `<div style="font-size:12px; color:rgba(255,255,255,.75); margin-top:4px; text-transform:uppercase; letter-spacing:.08em;">${d.bizTagline}</div>` : ''}
      ${d.bizPhone   ? `<div style="font-size:12px; color:rgba(255,255,255,.75); margin-top:3px;">📞 ${d.bizPhone}</div>` : ''}
      ${d.bizAddress ? `<div style="font-size:12px; color:rgba(255,255,255,.75); margin-top:3px;">📍 ${d.bizAddress}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px; font-weight:700; color:white; letter-spacing:.04em;">TAKSİT PLANI</div>
      <div style="font-size:11px; color:rgba(255,255,255,.7); margin-top:6px;">
          ${new Date().toLocaleDateString('tr-TR', {day:'numeric', month:'long', year:'numeric'})}
      </div>
      <div style="font-size:11px; color:rgba(255,255,255,.6); margin-top:2px;">No: TKS-${Date.now().toString().slice(-6)}</div>
    </div>
  </div>

  <!-- Renk şeridi -->
  <div style="height:4px; background:linear-gradient(90deg,#e8b4b8,#b8a9d4,#8fada1);"></div>

  <!-- Danışan + Paket bilgileri -->
  <div style="padding:32px 50px 0;">
    <div style="display:flex; gap:20px; background:#f9f7f4; border-radius:14px; padding:22px 26px; border:1px solid #ede8e2;">
      <div style="flex:1;">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9a8878; margin-bottom:6px;">Danışan</div>
        <div style="font-size:18px; font-weight:600; color:#2d3340; font-family:'Playfair Display',serif;">${d.client.name}</div>
        <div style="font-size:13px; color:#6b7280; margin-top:3px;">📱 ${d.client.phone}${d.client.email ? ' · 📧 ' + d.client.email : ''}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9a8878; margin-bottom:6px;">Paket</div>
        <div style="font-size:16px; font-weight:600; color:#2d3340;">${d.pkg.name}</div>
        <div style="font-size:13px; color:#6b7280; margin-top:3px;">${d.pkg.totalSessions} Seans</div>
      </div>
      <div style="text-align:right; flex-shrink:0;">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9a8878; margin-bottom:6px;">Kalan Tutar</div>
        <div style="font-size:26px; font-weight:700; color:#5f8076;">${d.remaining.toFixed(2)} ₺</div>
        <div style="font-size:12px; color:#9a8878; margin-top:2px;">${d.count} × ${d.perInstall.toFixed(2)} ₺</div>
      </div>
    </div>
  </div>

  <!-- Taksit tablosu -->
  <div style="padding:28px 50px 0;">
    <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#5f8076; margin-bottom:12px;">📅 Ödeme Takvimi</div>
    <table style="width:100%; border-collapse:collapse; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(45,51,64,.07);">
      <thead>
        <tr style="background:linear-gradient(135deg,#8fada1 0%,#5f8076 100%);">
          <th style="padding:13px 18px; text-align:left; font-size:11px; color:white; font-weight:600; letter-spacing:.05em; text-transform:uppercase;">Taksit</th>
          <th style="padding:13px 18px; text-align:left; font-size:11px; color:white; font-weight:600; letter-spacing:.05em; text-transform:uppercase;">Vade Tarihi</th>
          <th style="padding:13px 18px; text-align:right; font-size:11px; color:white; font-weight:600; letter-spacing:.05em; text-transform:uppercase;">Tutar</th>
          <th style="padding:13px 18px; text-align:center; font-size:11px; color:white; font-weight:600; letter-spacing:.05em; text-transform:uppercase;">Durum</th>
        </tr>
      </thead>
      <tbody>${d.rows}</tbody>
      <tfoot>
        <tr style="background:linear-gradient(135deg,#5f8076 0%,#3d5550 100%);">
          <td colspan="2" style="padding:15px 18px; font-weight:700; color:white; font-size:14px;">TOPLAM KALAN</td>
          <td style="padding:15px 18px; text-align:right; font-weight:700; color:white; font-size:18px;">${d.remaining.toFixed(2)} ₺</td>
          <td style="padding:15px 18px; text-align:center; color:rgba(255,255,255,.7); font-size:12px;">${d.count} taksit</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- İmza -->
  <div style="padding:40px 50px 80px; display:flex; gap:40px;">
    <div style="flex:1; border-top:2px solid #ede8e2; padding-top:12px;">
      <div style="font-size:11px; color:#9a8878; font-weight:700; text-transform:uppercase; letter-spacing:.05em;">Danışan İmzası</div>
      <div style="height:40px;"></div>
      <div style="font-size:13px; color:#6b7280;">${d.client.name}</div>
    </div>
    <div style="flex:1; border-top:2px solid #ede8e2; padding-top:12px;">
      <div style="font-size:11px; color:#9a8878; font-weight:700; text-transform:uppercase; letter-spacing:.05em;">Yetkili İmzası / Kaşe</div>
      <div style="height:40px;"></div>
      <div style="font-size:13px; color:#6b7280;">${d.bizName}</div>
    </div>
  </div>

  <!-- Sayfa footer -->
  <div style="position:absolute; bottom:0; left:0; right:0; padding:16px 50px;
       background:#f9f7f4; border-top:1px solid #ede8e2;
       display:flex; justify-content:space-between; align-items:center;">
    <div style="font-size:11px; color:#9a8878;">Bu belge ${d.bizName} tarafından düzenlenmiştir.</div>
    <div style="font-size:11px; color:#9a8878;">${new Date().toLocaleDateString('tr-TR')}</div>
  </div>

</div>
${printBar(900)}
</body></html>`;
    }

    // MAKBUZ
    const receiptNo = d.receiptNo;
    const pageStyle = `@page { margin:8mm; size:A5; }`;
    return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Makbuz ${receiptNo}</title>
<style>${baseStyle} ${pageStyle}</style></head><body>
<div style="max-width:520px; margin:16px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(45,51,64,.12);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#8fada1 0%,#5f8076 100%); padding:26px 30px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-family:'Playfair Display',serif; font-size:22px; font-weight:600; color:white;">${d.bizName}</div>
        ${d.bizTagline ? `<div style="font-size:11px; color:rgba(255,255,255,.7); margin-top:3px; text-transform:uppercase; letter-spacing:.07em;">${d.bizTagline}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="background:rgba(255,255,255,.2); padding:5px 14px; border-radius:20px; font-size:12px; font-weight:700; color:white; letter-spacing:.05em;">MAKBUZ</div>
        <div style="font-size:11px; color:rgba(255,255,255,.7); margin-top:5px;">${receiptNo}</div>
      </div>
    </div>
  </div>
  <div style="height:3px; background:linear-gradient(90deg,#e8b4b8,#b8a9d4,#8fada1);"></div>

  <div style="padding:24px 30px;">

    <!-- Danışan -->
    <div style="padding-bottom:18px; margin-bottom:18px; border-bottom:1px solid #ede8e2;">
      <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9a8878; margin-bottom:5px;">Danışan</div>
      <div style="font-size:18px; font-weight:600; color:#2d3340; font-family:'Playfair Display',serif;">${d.client.name}</div>
      <div style="font-size:12px; color:#6b7280; margin-top:3px;">${d.client.phone}${d.client.email ? ' · ' + d.client.email : ''}</div>
    </div>

    <!-- Detaylar -->
    <div style="margin-bottom:18px;">
      <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9a8878; margin-bottom:8px;">Ödeme Detayları</div>
      <div style="display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #f5f2ee;">
        <span style="font-size:13px; color:#6b7280;">Paket</span>
        <span style="font-size:13px; font-weight:500; color:#2d3340;">${d.pkg ? d.pkg.name : '—'}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #f5f2ee;">
        <span style="font-size:13px; color:#6b7280;">Tarih</span>
        <span style="font-size:13px; font-weight:500; color:#2d3340;">${new Date(d.payment.date).toLocaleDateString('tr-TR', {day:'numeric', month:'long', year:'numeric'})}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:9px 0;">
        <span style="font-size:13px; color:#6b7280;">Yöntem</span>
        <span style="font-size:13px; font-weight:500; color:#2d3340;">${d.payment.method || '—'}</span>
      </div>
    </div>

    <!-- Tutar -->
    <div style="background:linear-gradient(135deg,#8fada1 0%,#5f8076 100%); border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <div style="font-size:10px; color:rgba(255,255,255,.75); font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px;">Tahsil Edilen</div>
        <div style="font-size:28px; font-weight:700; color:white; font-family:'Playfair Display',serif;">${d.payment.amount.toFixed(2)} ₺</div>
      </div>
      <div style="font-size:44px; opacity:.35; line-height:1;">✓</div>
    </div>

    <!-- İşletme & teşekkür -->
    ${(d.bizPhone || d.bizAddress) ? `
    <div style="padding:12px 14px; background:#f9f7f4; border-radius:8px; border:1px solid #ede8e2; margin-bottom:16px;">
      ${d.bizPhone   ? `<div style="font-size:12px; color:#6b7280; margin-bottom:2px;">📞 ${d.bizPhone}</div>` : ''}
      ${d.bizAddress ? `<div style="font-size:12px; color:#6b7280;">📍 ${d.bizAddress}</div>` : ''}
    </div>` : ''}

    <div style="text-align:center; padding-top:14px; border-top:1px solid #ede8e2;">
      <div style="font-size:13px; color:#8fada1; font-weight:500;">🌿 Ödemeniz için teşekkür ederiz.</div>
      <div style="font-size:11px; color:#b0a898; margin-top:4px;">${new Date().toLocaleDateString('tr-TR')} · ${receiptNo}</div>
    </div>

  </div>
</div>
${printBar(680)}
</body></html>`;
}

function openPrintWindow(html, w, h) {
    const win = window.open('', '_blank', `width=${w},height=${h}`);
    if (!win) { showNotification('Pop-up engellendi — tarayıcı izni verin', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 900);
}

// ─── ÖDEME SONRASI MODAL ─────────────────────────────────────

function afterPaymentSaved(payment, client, pkg) {
    window._lastPayment = payment;
    window._lastClient  = client;
    window._lastPkg     = pkg;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:380px;">
            <div class="modal-header">
                <h3>✅ Ödeme Kaydedildi</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="modal-body" style="text-align:center; padding:28px 20px;">
                <div style="width:64px; height:64px; background:linear-gradient(135deg,var(--sage-light),var(--lav-light));
                     border-radius:50%; display:flex; align-items:center; justify-content:center;
                     font-size:28px; margin:0 auto 14px; color:var(--sage-dark);">✓</div>
                <p style="font-size:1.3rem; font-weight:700; color:var(--sage-dark);">${payment.amount.toFixed(0)} ₺</p>
                <p style="color:var(--stone); font-size:13px; margin-top:4px;">${client.name}${pkg ? ' — ' + pkg.name : ''}</p>
            </div>
            <div class="modal-footer" style="flex-direction:column; gap:8px;">
                <button class="btn btn-primary w-full"
                    onclick="generateReceiptPDF(window._lastPayment, window._lastClient, window._lastPkg); this.closest('.modal').remove()">
                    🖨️ Makbuz PDF İndir
                </button>
                <button class="btn btn-success w-full"
                    onclick="openWAComposer(window._lastClient.id,'payment_received',{pkg:window._lastPkg,amount:window._lastPayment?.amount?.toFixed(0)||''}); this.closest('.modal').remove()">
                    💬 Teşekkür Mesajı Gönder
                </button>
                <button class="btn btn-secondary w-full" onclick="this.closest('.modal').remove()">Kapat</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

// ─── YARDIMCILAR ─────────────────────────────────────────────

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

window.openInstallmentModal  = openInstallmentModal;
window.previewInstallments   = previewInstallments;
window.printInstallmentPDF   = printInstallmentPDF;
window.generateReceiptPDF    = generateReceiptPDF;
window.afterPaymentSaved     = afterPaymentSaved;
