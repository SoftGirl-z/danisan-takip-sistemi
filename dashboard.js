// ============================================================
// dashboard.js — Gelir/Gider Dashboard + Grafikler (Chart.js)
// ============================================================

function loadChartJS() {
    return new Promise((resolve) => {
        if (window.Chart) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

// ─── ANA DASHBOARD MODAL ─────────────────────────────────────

async function openDashboard() {
    await loadChartJS();

    const existing = document.getElementById('dashboardModal');
    if (existing) existing.remove();

    // Verileri hazırla
    const stats = computeDashboardStats();

    const modal = document.createElement('div');
    modal.id = 'dashboardModal';
    modal.className = 'modal active';
    modal.style.cssText = 'overflow-y:auto;';
    modal.innerHTML = `
        <div class="modal-content large" style="max-width:900px;">
            <div class="modal-header">
                <h3>📊 Gelir & İstatistik Dashboard</h3>
                <button class="close-btn" onclick="document.getElementById('dashboardModal').remove()">✕</button>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:24px;">

                <!-- KPI kartları -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px;">
                    ${[
                        { label:'Bu Ay Gelir',    value: stats.thisMonthIncome.toFixed(0)+' ₺', color:'var(--sage-dark)',   icon:'💰' },
                        { label:'Geçen Ay',        value: stats.lastMonthIncome.toFixed(0)+' ₺', color:'var(--lav-dark)',    icon:'📅' },
                        { label:'Toplam Alacak',   value: stats.totalDebt.toFixed(0)+' ₺',       color:'var(--blush-dark)',  icon:'⚠️' },
                        { label:'Aktif Danışan',   value: stats.activeClients,                    color:'var(--sage-dark)',   icon:'👥' },
                        { label:'Bu Ay Seans',     value: stats.thisMonthSessions,                color:'var(--lav-dark)',    icon:'📋' },
                        { label:'Ort. Gelir/Seans',value: stats.avgPerSession.toFixed(0)+' ₺',   color:'var(--stone)',       icon:'📈' },
                    ].map(k => `
                        <div style="background:var(--surface-2); border-radius:var(--r-md); padding:16px;
                             border:1px solid var(--border-soft); text-align:center;">
                            <div style="font-size:22px; margin-bottom:6px;">${k.icon}</div>
                            <div style="font-size:1.2rem; font-weight:700; color:${k.color};">${k.value}</div>
                            <div style="font-size:11px; color:var(--stone); margin-top:3px; text-transform:uppercase; letter-spacing:.04em;">${k.label}</div>
                        </div>`).join('')}
                </div>

                <!-- Son 6 ay gelir grafiği -->
                <div style="background:var(--surface-2); border-radius:var(--r-md); padding:20px; border:1px solid var(--border-soft);">
                    <h3 style="font-size:1rem; margin-bottom:16px;">📈 Son 6 Aylık Gelir</h3>
                    <div style="position:relative; height:220px;">
                        <canvas id="incomeChart"></canvas>
                    </div>
                </div>

                <!-- İki yan yana grafik -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div style="background:var(--surface-2); border-radius:var(--r-md); padding:20px; border:1px solid var(--border-soft);">
                        <h3 style="font-size:1rem; margin-bottom:16px;">🏷️ Seans Türleri</h3>
                        <div style="position:relative; height:180px;">
                            <canvas id="sessionTypeChart"></canvas>
                        </div>
                    </div>
                    <div style="background:var(--surface-2); border-radius:var(--r-md); padding:20px; border:1px solid var(--border-soft);">
                        <h3 style="font-size:1rem; margin-bottom:16px;">💳 Ödeme Yöntemleri</h3>
                        <div style="position:relative; height:180px;">
                            <canvas id="paymentMethodChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- En aktif danışanlar -->
                <div style="background:var(--surface-2); border-radius:var(--r-md); padding:20px; border:1px solid var(--border-soft);">
                    <h3 style="font-size:1rem; margin-bottom:14px;">🏆 En Aktif Danışanlar (Seans Sayısına Göre)</h3>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${stats.topClients.map((item, i) => `
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="width:24px; height:24px; background:var(--sage-light); border-radius:50%;
                                    display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;
                                    color:var(--sage-dark); flex-shrink:0;">${i+1}</span>
                                <div style="flex:1; min-width:0;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                        <span style="font-size:13px; font-weight:600; color:var(--ink);">${item.name}</span>
                                        <span style="font-size:12px; color:var(--stone);">${item.sessions} seans</span>
                                    </div>
                                    <div style="height:6px; background:var(--border); border-radius:999px; overflow:hidden;">
                                        <div style="height:100%; width:${item.pct}%; background:linear-gradient(90deg, var(--sage) 0%, var(--sage-dark) 100%); border-radius:999px; transition:width .6s;"></div>
                                    </div>
                                </div>
                            </div>`).join('')}
                    </div>
                </div>

                <!-- Aylık özet tablo -->
                <div style="background:var(--surface-2); border-radius:var(--r-md); padding:20px; border:1px solid var(--border-soft);">
                    <h3 style="font-size:1rem; margin-bottom:14px;">📅 Aylık Özet</h3>
                    <div style="overflow-x:auto;">
                        <table class="finance-table">
                            <thead>
                                <tr>
                                    <th>Ay</th><th>Gelir</th><th>Seans</th><th>Yeni Danışan</th><th>Aktif Paket</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.monthlyTable.map(row => `
                                <tr>
                                    <td><strong>${row.label}</strong></td>
                                    <td style="color:var(--sage-dark); font-weight:600;">${row.income.toFixed(0)} ₺</td>
                                    <td>${row.sessions}</td>
                                    <td>${row.newClients}</td>
                                    <td>${row.activePackages}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="exportDashboardPDF()">📄 PDF Rapor İndir</button>
                <button class="btn btn-secondary" onclick="document.getElementById('dashboardModal').remove()">Kapat</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    // Grafikleri çiz (DOM'a eklendikten sonra)
    requestAnimationFrame(() => drawCharts(stats));
}

// ─── VERİ HESAPLAMA ──────────────────────────────────────────

function computeDashboardStats() {
    const now     = new Date();
    const cl      = window.clientsData  || (typeof clients  !== 'undefined' ? clients  : []);
    const se      = window.sessionsData || (typeof sessions !== 'undefined' ? sessions : []);
    const pk      = window.packagesData || (typeof packages !== 'undefined' ? packages : []);
    const pa      = window.paymentsData || (typeof payments !== 'undefined' ? payments : []);

    // Bu ay / geçen ay
    const thisM = now.getMonth(), thisY = now.getFullYear();
    const lastM = thisM === 0 ? 11 : thisM - 1;
    const lastY = thisM === 0 ? thisY - 1 : thisY;

    const inMonth = (date, m, y) => { const d = new Date(date); return d.getMonth()===m && d.getFullYear()===y; };

    const thisMonthPayments = pa.filter(p => inMonth(p.date, thisM, thisY));
    const lastMonthPayments = pa.filter(p => inMonth(p.date, lastM, lastY));
    const thisMonthSess     = se.filter(s => inMonth(s.date, thisM, thisY));

    const thisMonthIncome = thisMonthPayments.reduce((s,p) => s+p.amount, 0);
    const lastMonthIncome = lastMonthPayments.reduce((s,p) => s+p.amount, 0);
    const totalDebt       = pk.reduce((s,p) => s+((p.price||0)-(p.paidAmount||0)), 0);
    const totalIncome     = pa.reduce((s,p) => s+p.amount, 0);
    const avgPerSession   = se.length > 0 ? totalIncome / se.length : 0;
    const activeClients   = cl.filter(c => pk.some(p => p.clientId===c.id && p.status==='active')).length;

    // Son 6 ay gelir
    const last6 = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(thisY, thisM - i, 1);
        const m = d.getMonth(), y = d.getFullYear();
        const income = pa.filter(p => inMonth(p.date, m, y)).reduce((s,p)=>s+p.amount, 0);
        const label  = d.toLocaleDateString('tr-TR', { month:'short', year:'2-digit' });
        last6.push({ label, income, month:m, year:y });
    }

    // Seans türleri
    const typeMap = {};
    se.forEach(s => { typeMap[s.type] = (typeMap[s.type] || 0) + 1; });

    // Ödeme yöntemleri
    const methodMap = {};
    pa.forEach(p => { const m = p.method || 'Diğer'; methodMap[m] = (methodMap[m]||0)+1; });

    // En aktif danışanlar
    const clientSessions = cl.map(c => ({
        name: c.name,
        sessions: se.filter(s => s.clientId === c.id).length
    })).sort((a,b) => b.sessions-a.sessions).slice(0, 5);
    const maxSess = clientSessions[0]?.sessions || 1;
    const topClients = clientSessions.map(c => ({ ...c, pct: Math.round(c.sessions/maxSess*100) }));

    // Aylık tablo (son 6 ay)
    const monthlyTable = last6.map(row => ({
        ...row,
        sessions:      se.filter(s => inMonth(s.date, row.month, row.year)).length,
        newClients:    cl.filter(c => c.createdAt && inMonth(c.createdAt, row.month, row.year)).length,
        activePackages: pk.filter(p => {
            if (!p.startDate) return false;
            const d = new Date(p.startDate);
            return d.getMonth()===row.month && d.getFullYear()===row.year;
        }).length
    }));

    return {
        thisMonthIncome, lastMonthIncome, totalDebt, avgPerSession,
        activeClients, thisMonthSessions: thisMonthSess.length,
        last6, typeMap, methodMap, topClients, monthlyTable
    };
}

// ─── CHART.JS GRAFİKLERİ ────────────────────────────────────

function drawCharts(stats) {
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.color       = '#6b7280';

    const sage   = '#8fada1';
    const lav    = '#b8a9d4';
    const blush  = '#e8b4b8';
    const warm   = '#e8c47c';
    const sage2  = '#6db89d';
    const blue   = '#7ba8d0';

    // 1) Bar — Son 6 ay gelir
    const incCtx = document.getElementById('incomeChart');
    if (incCtx) {
        new Chart(incCtx, {
            type: 'bar',
            data: {
                labels:   stats.last6.map(r => r.label),
                datasets: [{
                    label: 'Gelir (₺)',
                    data:  stats.last6.map(r => r.income),
                    backgroundColor: stats.last6.map((_, i) => i===5 ? sage : sage+'80'),
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#f0ece7' }, ticks: { callback: v => v.toLocaleString('tr-TR') + ' ₺' } }
                }
            }
        });
    }

    // 2) Doughnut — Seans türleri
    const stCtx = document.getElementById('sessionTypeChart');
    if (stCtx && Object.keys(stats.typeMap).length) {
        new Chart(stCtx, {
            type: 'doughnut',
            data: {
                labels:   Object.keys(stats.typeMap),
                datasets: [{ data: Object.values(stats.typeMap), backgroundColor: [sage, lav, blush, warm, sage2, blue], borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } },
                cutout: '60%'
            }
        });
    }

    // 3) Doughnut — Ödeme yöntemleri
    const pmCtx = document.getElementById('paymentMethodChart');
    if (pmCtx && Object.keys(stats.methodMap).length) {
        new Chart(pmCtx, {
            type: 'doughnut',
            data: {
                labels:   Object.keys(stats.methodMap),
                datasets: [{ data: Object.values(stats.methodMap), backgroundColor: [lav, sage, blush, warm], borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } },
                cutout: '60%'
            }
        });
    }
}

// ─── PDF RAPOR ───────────────────────────────────────────────

function exportDashboardPDF() {
    const stats   = computeDashboardStats();
    const profile = window._currentProfile || {};
    const bizName = profile.businessName || 'Studio';
    const now     = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
    const monthStr = now.toISOString().slice(0, 7);

    const kpis = [
        { label: 'Bu Ay Gelir',      value: stats.thisMonthIncome.toFixed(0) + ' ₺', icon: '💰' },
        { label: 'Geçen Ay',         value: stats.lastMonthIncome.toFixed(0) + ' ₺', icon: '📅' },
        { label: 'Toplam Alacak',    value: stats.totalDebt.toFixed(0) + ' ₺',       icon: '⚠️' },
        { label: 'Aktif Danışan',    value: String(stats.activeClients),              icon: '👥' },
        { label: 'Bu Ay Seans',      value: String(stats.thisMonthSessions),          icon: '📋' },
        { label: 'Ort. Seans Geliri',value: stats.avgPerSession.toFixed(0) + ' ₺',   icon: '📈' },
    ];

    const monthlyRows = stats.monthlyTable.map((row, i) => `
        <tr style="background:${i % 2 === 0 ? '#faf8f5' : '#fff'};">
            <td style="padding:11px 16px; font-weight:600; color:#2d3340;">${row.label}</td>
            <td style="padding:11px 16px; color:#5f8076; font-weight:700;">${row.income.toFixed(0)} ₺</td>
            <td style="padding:11px 16px; color:#6b7280; text-align:center;">${row.sessions}</td>
            <td style="padding:11px 16px; color:#6b7280; text-align:center;">${row.newClients}</td>
            <td style="padding:11px 16px; color:#6b7280; text-align:center;">${row.activePackages}</td>
        </tr>`).join('');

    const topRows = stats.topClients.map((c, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px 0;
             border-bottom:1px solid #f0ede8;">
            <div style="width:28px; height:28px; background:linear-gradient(135deg,#c4d7d1,#8fada1);
                 border-radius:50%; display:flex; align-items:center; justify-content:center;
                 font-size:12px; font-weight:700; color:#5f8076; flex-shrink:0;">${i + 1}</div>
            <div style="flex:1; font-size:14px; color:#2d3340; font-weight:500;">${c.name}</div>
            <div style="font-size:13px; font-weight:700; color:#5f8076;">${c.sessions} seans</div>
        </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Gelir Raporu — ${monthStr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'DM Sans',system-ui,sans-serif; background:#f5f3f0; color:#2d3340;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { margin:0; size:A4; }
  @media print { body { background:white; } .no-print { display:none !important; } }
  table { border-collapse:collapse; width:100%; }
</style>
</head>
<body>
<div style="max-width:794px; margin:0 auto; background:white; min-height:1123px; position:relative; padding-bottom:60px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#8fada1 0%,#5f8076 100%); padding:44px 52px 40px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-family:'Playfair Display',serif; font-size:32px; font-weight:600; color:white; letter-spacing:-.02em; line-height:1.1;">${bizName}</div>
        <div style="font-size:13px; color:rgba(255,255,255,.75); margin-top:6px; font-weight:500;">Gelir & Performans Raporu</div>
        <div style="font-size:12px; color:rgba(255,255,255,.6); margin-top:3px;">Düzenlenme: ${dateStr}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px; color:rgba(255,255,255,.6); text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px;">Dönem</div>
        <div style="font-size:18px; font-weight:700; color:white;">${monthStr}</div>
      </div>
    </div>
  </div>
  <div style="height:4px; background:linear-gradient(90deg,#e8b4b8,#b8a9d4,#8fada1);"></div>

  <div style="padding:36px 52px 0;">

    <!-- KPI grid -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:36px;">
      ${kpis.map(k => `
      <div style="background:#f9f7f4; border-radius:12px; padding:18px 20px; border:1px solid #ede8e2;">
        <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#9a8878; margin-bottom:8px;">${k.label}</div>
        <div style="font-size:22px; font-weight:700; color:#5f8076; font-family:'Playfair Display',serif;">${k.value}</div>
      </div>`).join('')}
    </div>

    <!-- Aylık tablo -->
    <div style="margin-bottom:32px;">
      <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#5f8076; margin-bottom:12px;">📅 Aylık Özet</div>
      <div style="border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(45,51,64,.07);">
        <table>
          <thead>
            <tr style="background:linear-gradient(135deg,#8fada1,#5f8076);">
              <th style="padding:12px 16px; text-align:left; font-size:11px; color:white; font-weight:600; letter-spacing:.05em;">AY</th>
              <th style="padding:12px 16px; text-align:left; font-size:11px; color:white; font-weight:600; letter-spacing:.05em;">GELİR</th>
              <th style="padding:12px 16px; text-align:center; font-size:11px; color:white; font-weight:600; letter-spacing:.05em;">SEANS</th>
              <th style="padding:12px 16px; text-align:center; font-size:11px; color:white; font-weight:600; letter-spacing:.05em;">YENİ DANIŞAN</th>
              <th style="padding:12px 16px; text-align:center; font-size:11px; color:white; font-weight:600; letter-spacing:.05em;">AKTİF PAKET</th>
            </tr>
          </thead>
          <tbody>${monthlyRows}</tbody>
          <tfoot>
            <tr style="background:linear-gradient(135deg,#5f8076,#3d5550);">
              <td style="padding:13px 16px; font-weight:700; color:white;">TOPLAM</td>
              <td style="padding:13px 16px; font-weight:700; color:white; font-size:15px;">
                ${stats.monthlyTable.reduce((s,r)=>s+r.income,0).toFixed(0)} ₺
              </td>
              <td style="padding:13px 16px; font-weight:700; color:white; text-align:center;">
                ${stats.monthlyTable.reduce((s,r)=>s+r.sessions,0)}
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- En aktif danışanlar -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
      <div>
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#5f8076; margin-bottom:12px;">🏆 En Aktif Danışanlar</div>
        <div style="background:#f9f7f4; border-radius:12px; padding:16px 20px; border:1px solid #ede8e2;">
          ${topRows || '<div style="color:#9a8878; font-size:13px; text-align:center; padding:12px;">Seans verisi yok</div>'}
        </div>
      </div>
      <div>
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#5f8076; margin-bottom:12px;">📊 Özet Bilgiler</div>
        <div style="background:#f9f7f4; border-radius:12px; padding:16px 20px; border:1px solid #ede8e2;">
          ${[
            ['Toplam Danışan', stats.topClients.length ? stats.topClients.reduce((s,c)=>s+c.sessions,0) + ' seans kaydedildi' : '—'],
            ['Bu Ay Gelir', stats.thisMonthIncome.toFixed(0) + ' ₺'],
            ['Geçen Ay Gelir', stats.lastMonthIncome.toFixed(0) + ' ₺'],
            ['Toplam Alacak', stats.totalDebt.toFixed(0) + ' ₺'],
            ['Aktif Danışan', String(stats.activeClients)],
          ].map(([k,v]) => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f0ede8;">
            <span style="font-size:13px; color:#6b7280;">${k}</span>
            <span style="font-size:13px; font-weight:600; color:#2d3340;">${v}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div style="position:absolute; bottom:0; left:0; right:0; padding:16px 52px; background:#f9f7f4; border-top:1px solid #ede8e2; display:flex; justify-content:space-between; align-items:center;">
    <div style="font-size:11px; color:#9a8878;">${bizName} — Otomatik oluşturulmuş rapor</div>
    <div style="font-size:11px; color:#9a8878;">${dateStr}</div>
  </div>

</div>

<div class="no-print" style="text-align:center; padding:16px; background:#f0ede8; border-top:1px solid #ddd8d2;">
  <button onclick="window.print()" style="padding:11px 28px; background:#5f8076; color:white; border:none;
      border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; margin-right:8px;">
    🖨️ PDF Kaydet / Yazdır
  </button>
  <button onclick="window.close()" style="padding:11px 20px; background:#e8e2db; color:#2d3340; border:none; border-radius:8px; font-size:14px; cursor:pointer;">
    Kapat
  </button>
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=950,height=750');
    if (!w) { showNotification('Pop-up engellendi — izin verin', 'warning'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 900);
    showNotification('Rapor hazırlanıyor...', 'success');
}

window.openDashboard      = openDashboard;
window.exportDashboardPDF = exportDashboardPDF;
