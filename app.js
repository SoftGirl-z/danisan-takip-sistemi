// ========================================
// FIRESTORE-AUTH INTEGRATION (FINAL)
// ========================================

import {
    onAuthChange,
    logoutUser as fbLogout,
    upsertClient,
    getClients,
    deleteClient as fbDeleteClient,
    updateClient as fbUpdateClient,
    upsertSession,
    getSessions,
    deleteSession as fbDeleteSession,
    upsertPackage,
    getPackages,
    deletePackage as fbDeletePackage,
    updatePackage as fbUpdatePackage,
    upsertPayment,
    getPayments,
    deletePayment as fbDeletePayment,
    saveProfile,
    getProfile
} from './firebase-config.js';

// ========================================
// GLOBAL VARIABLES
// ========================================

let clients = [];
let sessions = [];
let packages = [];
let payments = [];
let currentUser = null;
let currentCalendarDate = new Date();

// ========================================
// INITIALIZE APP
// ========================================

window.addEventListener('load', async function() {
    console.log('✅ Uygulama başlatılıyor...');

    // DOM hazır mı kontrol et
    const userDisplayEl  = document.getElementById('userDisplay');
    const guestDisplayEl = document.getElementById('guestDisplay');
    const userNameEl     = document.getElementById('currentUserName');

    if (!userDisplayEl) {
        console.error('❌ userDisplay elementi bulunamadı');
        return;
    }

    // Formu başlat (auth beklemeden)
    initializeForm();
    renderClients(); // boş liste göster
    updateStats();

    // Auth state dinle
    onAuthChange(async function(user) {
        console.log('🔐 Auth değişti:', user ? user.email : 'null');

        if (!user) {
            currentUser = null;
            if (userDisplayEl)  userDisplayEl.style.display  = 'none';
            if (guestDisplayEl) guestDisplayEl.style.display = 'flex';
            return;
        }

        // Kullanıcı giriş yaptı
        currentUser = user;
        if (userDisplayEl)  userDisplayEl.style.display  = 'flex';
        if (guestDisplayEl) guestDisplayEl.style.display = 'none';
        if (userNameEl)     userNameEl.textContent        = user.email || 'Kullanıcı';

        // Veri yükle
        await loadDataFromFirestore(user.uid);
        syncGlobalDataRefs();
        updateClientSelects();
        renderClients();
        updateStats();
        updateNotifBadge();
        renderCalendar();

        // Profil yükle
        if (typeof loadAndApplyProfile === 'function') {
            await loadAndApplyProfile(user.uid);
        }

        // Seans türlerini yükle
        await loadSessionTypes();
        // Fiyat listesini Firestore'dan yükle (auth sonrası)
        await loadPriceTemplates();
        if (typeof renderPriceList === 'function') renderPriceList();

        // Giderleri yükle
        await loadExpenses();
        updateFinanceKPIs();

        // Döviz
        loadSavedCurrency();
        fetchExchangeRates();

        // Eğitmenler
        await loadInstructors();
        updateInstructorSelects();

        // Doğum günü kontrolü
        if (typeof showBirthdayAlert === 'function') {
            showBirthdayAlert(clients);
        }

        // Sabah hatırlatıcı
        if (typeof checkMorningReminder === 'function') {
            checkMorningReminder(sessions, clients);
        }

        console.log('✅ Yüklendi:', clients.length, 'danışan');
    });
});

// ========================================
// LOGIN & AUTH
// ========================================

// Legacy storage login fonksiyonu artık kullanılmıyor (Firebase Auth kullanılıyor)
async function checkLoginStatus() {
    // no-op
}

async function logout() {
    if (!confirm('Çıkış yapmak istediğinizden emin misiniz?')) return;
    try {
        await fbLogout();
        window.location.href = 'index.html';
    } catch (error) {
        alert('Çıkış hatası: ' + error.message);
    }
}

// ========================================
// DATA MANAGEMENT
// ========================================

async function loadDataFromFirestore(uid) {
    if (!uid) {
        console.warn('loadDataFromFirestore: uid yok, atlanıyor');
        return;
    }
    try {
        console.log('🔄 Firestore yükleniyor... uid:', uid);
        const [c, s, p, pay] = await Promise.all([
            getClients(uid),
            getSessions(uid),
            getPackages(uid),
            getPayments(uid)
        ]);
        clients  = c   || [];
        sessions = s   || [];
        packages = p   || [];
        payments = pay || [];
        console.log('✅ Firestore yüklendi:', clients.length, 'danışan,', sessions.length, 'seans,', packages.length, 'paket,', payments.length, 'ödeme');
    } catch (e) {
        console.error('❌ Firestore yükleme hatası:', e);
        clients  = [];
        sessions = [];
        packages = [];
        payments = [];

        // Hata mesajını kullanıcıya göster
        const isPermission = e?.code === 'permission-denied' || e?.message?.includes('permission');
        if (isPermission) {
            showFirestoreError('permission');
        } else {
            showFirestoreError('general', e?.message || String(e));
        }
    }
}

function showFirestoreError(type, detail) {
    const existing = document.getElementById('firestoreErrorBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'firestoreErrorBanner';
    banner.style.cssText = [
        'position:fixed', 'top:70px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:9999', 'background:#fff', 'border:2px solid #e57373',
        'border-radius:12px', 'padding:16px 22px',
        'box-shadow:0 8px 32px rgba(0,0,0,.15)',
        'max-width:480px', 'width:calc(100% - 32px)',
        'font-family:sans-serif'
    ].join(';');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:#999;';
    closeBtn.onclick = function() { banner.remove(); };

    if (type === 'permission') {
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700;color:#c62828;margin-bottom:8px;';
        title.textContent = '🔒 Firestore İzin Hatası';

        const desc = document.createElement('div');
        desc.style.cssText = 'font-size:13px;color:#555;line-height:1.6;';
        desc.textContent = 'Firebase Console dan Firestore guvenlik kurallarini guncelleyin:';

        const rules = [
            "rules_version = '2';",
            "service cloud.firestore {",
            "  match /databases/{database}/documents {",
            "    match /users/{userId}/{document=**} {",
            "      allow read, write: if request.auth.uid == userId;",
            "    }",
            "  }",
            "}"
        ].join('\n');

        const code = document.createElement('pre');
        code.style.cssText = 'background:#f5f5f5;padding:8px 10px;border-radius:6px;font-size:11px;margin:8px 0;overflow:auto;white-space:pre;';
        code.textContent = rules;

        const link = document.createElement('a');
        link.href = 'https://console.firebase.google.com';
        link.target = '_blank';
        link.style.cssText = 'color:#1565c0;font-weight:600;font-size:13px;';
        link.textContent = 'Firebase Console a Git';

        banner.appendChild(closeBtn);
        banner.appendChild(title);
        banner.appendChild(desc);
        banner.appendChild(code);
        banner.appendChild(link);

    } else {
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700;color:#c62828;margin-bottom:6px;';
        title.textContent = 'Veri yuklenemedi';

        const msg = document.createElement('div');
        msg.style.cssText = 'font-size:13px;color:#555;margin-bottom:10px;';
        msg.textContent = detail || 'Bilinmeyen hata';

        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Tekrar Dene';
        retryBtn.style.cssText = 'padding:7px 16px;background:#1565c0;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;';
        retryBtn.onclick = function() {
            banner.remove();
            const uid = currentUser && currentUser.uid;
            if (uid) {
                loadDataFromFirestore(uid).then(function() {
                    syncGlobalDataRefs();
                    renderClients();
                    updateStats();
                });
            }
        };

        banner.appendChild(closeBtn);
        banner.appendChild(title);
        banner.appendChild(msg);
        banner.appendChild(retryBtn);
    }

    document.body.appendChild(banner);
}

// Legacy (storage) saveData artık kullanılmıyor
async function saveData() {
    // no-op
}

// ========================================
// FORM INITIALIZATION
// ========================================

function initializeForm() {
    updateClientSelects();

    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const localDate = today.toISOString().split('T')[0];

    document.getElementById('sessionDate').value = localDate;
    document.getElementById('packageStartDate').value = localDate;
    document.getElementById('paymentDate').value = localDate;
}

function updateClientSelects() {
    const selects = ['sessionClient', 'packageClient', 'paymentClient'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Danışan Seç --</option>';
        
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.name} (${client.phone})`;
            select.appendChild(option);
        });
        
        if (currentValue) select.value = currentValue;
    });
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${type === 'success' ? '✅' : '⚠️'} ${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// TAB SWITCHING
// ========================================

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    document.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('onclick') && t.getAttribute('onclick').includes("'" + tab + "'")) {
            t.classList.add('active');
        }
    });

    if (tab === 'clients') {
        document.getElementById('clientsPage').classList.add('active');
        renderClients();
    } else if (tab === 'calendar') {
        document.getElementById('calendarPage').classList.add('active');
        renderCalendar();
    } else if (tab === 'packages') {
        document.getElementById('packagesPage').classList.add('active');
        renderPackages();
    } else if (tab === 'finance') {
        document.getElementById('financePage').classList.add('active');
        renderFinance();
    } else if (tab === 'pricelist') {
        document.getElementById('pricelistPage').classList.add('active');
        renderPriceList();
    }
}

// ========================================
// CLIENT MANAGEMENT
// ========================================

function openAddClientModal() {
    document.getElementById('addClientModal').classList.add('active');
    clearClientForm();
}

function closeAddClientModal() {
    document.getElementById('addClientModal').classList.remove('active');
}

function clearClientForm() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientComplaints').value = '';
    document.getElementById('clientNotes').value = '';
}

async function saveClient() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    const complaints = document.getElementById('clientComplaints').value.trim();
    const notes = document.getElementById('clientNotes').value.trim();
    const birthdate = document.getElementById('clientBirthdate')?.value || '';

    if (!name || !phone) {
        alert('❌ Ad ve telefon zorunlu!');
        return;
    }

    if (!currentUser) {
        alert('❌ Lütfen önce giriş yapın.');
        return;
    }

    const client = {
        id: 'client-' + Date.now(),
        name,
        phone,
        email,
        complaints,
        notes,
        birthdate,
        createdAt: new Date().toISOString(),
        status: 'active',
        messages: [],
        totalSessions: 0
    };

    // Firestore'a yaz (deterministic id)
    await upsertClient(currentUser.uid, client.id, client);

    // Firestore'dan tekrar çek (single source of truth)
    clients = await getClients(currentUser.uid);

    renderClients();
    updateStats();
    updateClientSelects();
    closeAddClientModal();
    showNotification('Danışan eklendi ✓', 'success');

    // Hoş geldin mesajı teklifi
    const newClient = clients.find(c => c.id === client.id) || client;
    if (newClient.phone) {
        setTimeout(() => {
            const toast = document.createElement('div');
            toast.style.cssText = `position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
                background:var(--surface); border-radius:var(--r-lg); box-shadow:var(--shadow-xl);
                padding:14px 18px; z-index:9999; min-width:290px; max-width:360px;
                border:1.5px solid var(--sage-light); display:flex; align-items:center; gap:12px;
                animation:fadeUp .4s ease both;`;
            toast.innerHTML = `
                <span style="font-size:24px;">💬</span>
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:600; color:var(--ink); margin-bottom:6px;">
                        Hoş geldin mesajı gönderilsin mi?
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button onclick="openWAComposer('${client.id}','welcome',{}); this.closest('[style]').remove()"
                            class="btn btn-success btn-sm">💬 Gönder</button>
                        <button onclick="this.closest('[style]').remove()"
                            class="btn btn-ghost btn-sm">Atla</button>
                    </div>
                </div>`;
            document.body.appendChild(toast);
            setTimeout(() => { if(toast.parentNode){toast.style.opacity='0';toast.style.transition='opacity .3s';setTimeout(()=>toast.remove(),300);} }, 10000);
        }, 600);
    }
}
function addClientMessage(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const text = prompt("Danışan için not ekleyin:");
    if (!text || !text.trim()) return;

    const message = {
        id: "msg-" + Date.now(),
        text: text.trim(),
        date: new Date().toLocaleString("tr-TR")
    };

    if (!client.messages) client.messages = [];
    client.messages.push(message);

    if (!currentUser) {
        alert('❌ Giriş yapmadan kayıt yapılamaz.');
        return;
    }

    // Firestore güncelle
    fbUpdateClient(currentUser.uid, clientId, { messages: client.messages });

    renderClients();
    showNotification("Not eklendi (Firestore)", "success");
}
function toggleClientStatus(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    client.status = client.status === "frozen" ? "active" : "frozen";

    if (!currentUser) {
        alert('❌ Giriş yapmadan güncelleme yapılamaz.');
        return;
    }

    fbUpdateClient(currentUser.uid, clientId, { status: client.status });
    renderClients();
    showNotification("Danışan durumu güncellendi (Firestore)", "success");
}
function deleteClient(clientId) {
    if (!confirm("Bu danışanı silmek istediğinizden emin misiniz?")) return;

    if (!currentUser) {
        alert('❌ Giriş yapmadan silme yapılamaz.');
        return;
    }

    // Firestore: danışanı sil
    Promise.resolve()
        .then(() => fbDeleteClient(currentUser.uid, clientId))
        .then(async () => {
            // ilişkili kayıtları da sil (basit cascade)
            const toDeleteSessions = sessions.filter(s => s.clientId === clientId);
            const toDeletePackages = packages.filter(p => p.clientId === clientId);
            const toDeletePayments = payments.filter(p => p.clientId === clientId);

            await Promise.all(toDeleteSessions.map(s => fbDeleteSession(currentUser.uid, s.id)));
            await Promise.all(toDeletePackages.map(p => fbDeletePackage(currentUser.uid, p.id)));
            await Promise.all(toDeletePayments.map(p => fbDeletePayment(currentUser.uid, p.id)));

            // tekrar çek
            await loadDataFromFirestore(currentUser.uid);
            renderClients();
            renderCalendar();
            updateStats();
            updateClientSelects();
            showNotification("Danışan silindi (Firestore)", "success");
        })
        .catch(err => {
            console.error(err);
            alert('❌ Silme hatası: ' + (err?.message || err));
        });
}


// ========================================
// SESSION MANAGEMENT
// ========================================

function openAddSessionModal(preClientId = null) {
    document.getElementById('addSessionModal').classList.add('active');
    clearSessionForm();

    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('sessionDate').value = d.toISOString().split('T')[0];
    document.getElementById('sessionTime').value = '09:00';

    if (preClientId) {
        document.getElementById('sessionClient').value = preClientId;
        checkSessionConflict(); // anlık kontrol
    }
}

function closeAddSessionModal() {
    document.getElementById('addSessionModal').classList.remove('active');
}

function clearSessionForm() {
    document.getElementById('sessionClient').value = '';
    document.getElementById('sessionDate').value = '';
    document.getElementById('sessionTime').value = '09:00';
    document.getElementById('sessionType').value = 'Fizyoterapi';
    document.getElementById('sessionDuration').value = '60';
    document.getElementById('sessionNotes').value = '';
}

async function saveSession() {
    const clientId = document.getElementById('sessionClient').value;
    const date = document.getElementById('sessionDate').value;
    const time = document.getElementById('sessionTime').value;
    const type = document.getElementById('sessionType').value;
    const duration = parseInt(document.getElementById('sessionDuration').value) || 60;
    const notes = document.getElementById('sessionNotes').value.trim();

    if (!clientId || !date || !time || !type) {
        alert('❌ Zorunlu alanları doldurun!');
        return;
    }

    if (!currentUser) {
        alert('❌ Lütfen önce giriş yapın.');
        return;
    }

    // Çakışma kontrolü
    const conflict = sessions.find(s =>
        s.clientId === clientId && s.date === date && s.time === time && s.status !== 'absent'
    );
    if (conflict) {
        const ok = confirm(`⚠️ Bu danışanın ${date} tarihinde ${time}'da zaten bir seansı var.\nYine de eklemek istiyor musunuz?`);
        if (!ok) return;
    }

    const session = {
        id: 'session-' + Date.now(),
        clientId,
        date,
        time,
        type,
        duration,
        notes,
        createdAt: new Date().toISOString()
    };

    // Firestore'a yaz
    await upsertSession(currentUser.uid, session.id, session);

    // Paket seans azaltma - seçili paket varsa onu kullan, yoksa aktif paketi bul
    const _pkgId = window._overridePackageId;
    window._overridePackageId = null;
    const pkg = _pkgId
        ? packages.find(p => p.id === _pkgId)
        : packages.find(p => p.clientId === clientId && p.status === 'active');
    if (pkg && typeof pkg.remainingSessions === 'number' && pkg.remainingSessions > 0) {
        const newRemaining = pkg.remainingSessions - 1;
        const newStatus = newRemaining === 0 ? 'completed' : pkg.status;
        pkg.remainingSessions = newRemaining;
        pkg.status = newStatus;
        await fbUpdatePackage(currentUser.uid, pkg.id, {
            remainingSessions: pkg.remainingSessions,
            status: pkg.status
        });
        // Paket bitiyor / bitti uyarısı
        if (newRemaining === 0) {
            const c = clients.find(c => c.id === clientId);
            showPackageWarningToast(c, pkg, 0);
        } else if (newRemaining <= 2) {
            const c = clients.find(c => c.id === clientId);
            showPackageWarningToast(c, pkg, newRemaining);
        }
    }

    // Tek kaynak: Firestore'dan yeniden yükle
    await loadDataFromFirestore(currentUser.uid);

    renderClients();
    renderCalendar();
    updateStats();
    closeAddSessionModal();
    showNotification('Seans eklendi (Firestore)', 'success');
}

async function deleteSession(sessionId) {
    if (!confirm('Bu seansı silmek istediğinizden emin misiniz?')) return;
    if (!currentUser) {
        alert('❌ Lütfen önce giriş yapın.');
        return;
    }

    try {
        await fbDeleteSession(currentUser.uid, sessionId);
        await loadDataFromFirestore(currentUser.uid);
        renderClients();
        renderCalendar();
        updateStats();
        showNotification('Seans silindi (Firestore)', 'success');
    } catch (e) {
        console.error(e);
        alert('❌ Seans silme hatası: ' + (e?.message || e));
    }
}

// ========================================
// PACKAGE MANAGEMENT (TARİH KAYMA DÜZELTİLDİ)
// ========================================

function openAddPackageModal(clientId = null) {
    document.getElementById('addPackageModal').classList.add('active');
    clearPackageForm();
    
    if (clientId) {
        document.getElementById('packageClient').value = clientId;
    }
    
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('packageStartDate').value = d.toISOString().split('T')[0];
}

function closeAddPackageModal() {
    document.getElementById('addPackageModal').classList.remove('active');
}

function clearPackageForm() {
    document.getElementById('packageClient').value = '';
    document.getElementById('packageName').value = '';
    document.getElementById('packageSessions').value = '10';
    document.getElementById('packagePrice').value = '';
    document.getElementById('packagePaid').value = '0';
    document.getElementById('packageStartDate').value = '';
}

async function savePackage() {
    const clientId = document.getElementById('packageClient').value;
    const name = document.getElementById('packageName').value.trim();
    const totalSessions = parseInt(document.getElementById('packageSessions').value);
    const price = parseFloat(document.getElementById('packagePrice').value);
    const paid = parseFloat(document.getElementById('packagePaid').value) || 0;
    const startDate = document.getElementById('packageStartDate').value;

    if (!clientId || !name || !totalSessions || !price) {
        alert('❌ Zorunlu alanları doldurun!');
        return;
    }

    if (!currentUser) {
        alert('❌ Lütfen önce giriş yapın.');
        return;
    }

    const pkg = {
        id: 'package-' + Date.now(),
        clientId,
        name,
        totalSessions,
        remainingSessions: totalSessions,
        price,
        paidAmount: paid,
        startDate,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    await upsertPackage(currentUser.uid, pkg.id, pkg);
    await loadDataFromFirestore(currentUser.uid);

    renderPackages();
    renderClients();
    updateStats();
    closeAddPackageModal();
    showNotification('Paket eklendi (Firestore)', 'success');
}

async function deletePackage(packageId) {
    if (!confirm('Bu paketi silmek istediğinizden emin misiniz?')) return;
    if (!currentUser) {
        alert('❌ Lütfen önce giriş yapın.');
        return;
    }

    try {
        // Paketi sil
        await fbDeletePackage(currentUser.uid, packageId);

        // Pakete ait ödemeleri de sil (basit cascade)
        const toDeletePayments = payments.filter(p => p.packageId === packageId);
        await Promise.all(toDeletePayments.map(p => fbDeletePayment(currentUser.uid, p.id)));

        await loadDataFromFirestore(currentUser.uid);
        renderPackages();
        renderFinance();
        renderClients();
        updateStats();
        showNotification('Paket silindi (Firestore)', 'success');
    } catch (e) {
        console.error(e);
        alert('❌ Paket silme hatası: ' + (e?.message || e));
    }
}

// ========================================
// PAYMENT MANAGEMENT (TARİH KAYMA DÜZELTİLDİ)
// ========================================

function openPaymentModal(packageId) {
    const pkg    = packages.find(p => p.id === packageId);
    if (!pkg) return;
    const client = clients.find(c => c.id === pkg.clientId);
    if (!client) return;

    const remaining = (pkg.price || 0) - (pkg.paidAmount || 0);
    const sym = pkg.priceCurrency === 'USD' ? '$' : pkg.priceCurrency === 'EUR' ? '€' : pkg.priceCurrency === 'GBP' ? '£' : '₺';

    document.getElementById('paymentPackageInfo').innerHTML =
        '<strong>' + client.name + '</strong><br>' +
        '<strong>' + pkg.name + '</strong><br>' +
        '<span style="color:var(--danger);">Kalan: ' + sym + remaining.toFixed(2) + '</span>';

    document.getElementById('paymentAmount').value  = remaining > 0 ? remaining : '';
    document.getElementById('paymentPackage').value = packageId;
    document.getElementById('paymentClient').value  = pkg.clientId;

    // Para birimi eşitle
    const payCurSel = document.getElementById('paymentCurrency');
    if (payCurSel && pkg.priceCurrency) payCurSel.value = pkg.priceCurrency;

    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('paymentDate').value = d.toISOString().split('T')[0];

    // editClientModal açıksa geçici olarak arkaya it
    const editModal = document.getElementById('editClientModal');
    if (editModal && editModal.classList.contains('active')) {
        editModal.style.zIndex = '500';
    }

    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    // editClientModal'ı geri getir
    const editModal = document.getElementById('editClientModal');
    if (editModal) editModal.style.zIndex = '';
}

async function savePayment() {
    const packageId = document.getElementById('paymentPackage').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;

    if (!packageId || !amount || !date) {
        alert('❌ Zorunlu alanları doldurun!');
        return;
    }

    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) {
        alert('❌ Paket bulunamadı');
        return;
    }

    if (!currentUser) {
        alert('❌ Lütfen önce giriş yapın.');
        return;
    }

    const payment = {
        id: 'payment-' + Date.now(),
        packageId,
        clientId: pkg.clientId,
        amount,
        date,
        method,
        createdAt: new Date().toISOString()
    };

    // 1) Ödemeyi Firestore'a yaz
    await upsertPayment(currentUser.uid, payment.id, payment);

    // 2) Paketin paidAmount'unu Firestore'da güncelle
    const newPaidAmount = (parseFloat(pkg.paidAmount) || 0) + amount;
    await fbUpdatePackage(currentUser.uid, pkg.id, { paidAmount: newPaidAmount });

    // 3) Yeniden yükle
    await loadDataFromFirestore(currentUser.uid);

    renderPackages();
    renderFinance();
    renderClients();
    syncGlobalDataRefs();
    updateNotifBadge();
    closePaymentModal();

    // Makbuz/taksit seçeneği sun
    const savedPkg    = packages.find(p => p.id === packageId);
    const savedClient = clients.find(c => c.id === (savedPkg?.clientId));

    // editClientModal açıksa yenile
    const editModal = document.getElementById('editClientModal');
    if (editModal && editModal.classList.contains('active') && savedClient) {
        editModal.style.zIndex = '';
        openEditClientModal(savedClient.id);
    }

    if (typeof afterPaymentSaved === 'function' && savedClient && savedPkg) {
        window._lastPaymentForWA = { payment, client: savedClient, pkg: savedPkg };
        afterPaymentSaved(payment, savedClient, savedPkg);
    } else {
        showNotification('Ödeme kaydedildi ✓', 'success');
    }
}

// ========================================
// RENDERING — Updated for new CSS design
// ========================================


// ========================================
// RENDERING — Updated for new CSS design
// ========================================

function renderClients() {
    const container = document.getElementById('clientsList');
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('filterStatus')?.value || 'all';
    const filterType = document.getElementById('filterSessionType')?.value || 'all';
    const filterPayment = document.getElementById('filterPayment')?.value || 'all';

    let filtered = clients;
    if (search) {
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(search) || c.phone.includes(search)
        );
    }
    if (filterStatus === 'active') {
        filtered = filtered.filter(c => packages.some(p => p.clientId === c.id && p.status === 'active'));
    } else if (filterStatus === 'inactive') {
        filtered = filtered.filter(c => !packages.some(p => p.clientId === c.id && p.status === 'active'));
    }
    if (filterType !== 'all') {
        filtered = filtered.filter(c => sessions.some(s => s.clientId === c.id && s.type === filterType));
    }
    if (filterPayment === 'paid') {
        filtered = filtered.filter(c => {
            const pkgs = packages.filter(p => p.clientId === c.id);
            return pkgs.length > 0 && pkgs.every(p => p.price <= p.paidAmount);
        });
    } else if (filterPayment === 'debt') {
        filtered = filtered.filter(c => {
            const pkgs = packages.filter(p => p.clientId === c.id);
            return pkgs.some(p => p.price > p.paidAmount);
        });
    }

    document.getElementById('clientCount').textContent = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👤</div>
                <p>Henüz danışan eklenmemiş</p>
                <span>Yeni danışan eklemek için yukarıdaki butonu kullanın</span>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(client => {
        const status = client.status || 'active';
        const messages = client.messages || [];

        const clientSessions = sessions
            .filter(s => s.clientId === client.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const clientPackages = packages.filter(p => p.clientId === client.id);
        const activePackage = clientPackages.find(p => p.status === 'active');
        const clientPayments = payments.filter(p => p.clientId === client.id);

        const totalPackageValue = clientPackages.reduce((sum, p) => sum + p.price, 0);
        const totalPaid = (client.totalPaid != null
            ? client.totalPaid
            : clientPayments.reduce((sum, p) => sum + p.amount, 0));
        const totalDebt = totalPackageValue - totalPaid;

        const createdAtStr = client.createdAt
            ? new Date(client.createdAt).toLocaleDateString('tr-TR') : '-';
        const lastSessionDate = clientSessions.length
            ? new Date(clientSessions[0].date).toLocaleDateString('tr-TR') : '-';
        const lastMessage = messages.length ? messages[messages.length - 1] : null;

        const statusLabel = status === 'frozen' ? 'Donduruldu' : 'Aktif';
        const statusClass = status === 'frozen' ? 'badge badge-frozen' : 'badge badge-active';

        return `
        <div class="client-card" style="padding:16px 20px;" id="card_${client.id}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                        <input type="checkbox" class="client-checkbox" data-id="${client.id}"
                            onchange="onClientCheckChange()"
                            style="accent-color:var(--sage-dark); width:15px; height:15px; flex-shrink:0;">
                        <span class="client-name" onclick="openEditClientModal('${client.id}')" style="font-size:1rem;">${client.name}</span>
                        <span class="${statusClass}">${statusLabel}</span>
                        ${totalDebt > 0 ? `<span class="badge" style="background:rgba(217,128,137,.12);color:var(--danger);border:1px solid rgba(217,128,137,.3);">
                            ${typeof formatCurrency === 'function' ? formatCurrency(totalDebt) : totalDebt.toFixed(0)+' ₺'} borç</span>` : ''}
                    </div>
                    <div style="font-size:12px; color:var(--stone); display:flex; gap:12px; flex-wrap:wrap;">
                        <span>📱 ${client.phone}</span>
                        ${lastSessionDate !== '-' ? `<span>🕐 ${lastSessionDate}</span>` : ''}
                    </div>
                </div>
                <div style="font-size:11px; color:var(--stone); text-align:right; flex-shrink:0; white-space:nowrap;">
                    📅 ${createdAtStr}
                </div>
            </div>

            <div class="client-actions" style="position:relative; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-soft);">
                <button class="btn btn-success btn-sm" onclick="quickCheckIn('${client.id}')"
                    style="background:linear-gradient(135deg,#6db89d,#4da080);">
                    ✓ Geldi
                </button>
                <button class="btn btn-danger btn-sm" onclick="openAbsenceModal('${client.id}')"
                    style="background:linear-gradient(135deg,#d98089,#c0606a);">
                    ✕ Gelmedi
                </button>
                <button class="btn btn-secondary btn-sm" onclick="openAddSessionModal('${client.id}')">＋ Seans</button>
                <button class="btn btn-ghost btn-sm" onclick="openEditClientModal('${client.id}')" style="color:var(--sage-dark); border:1.5px solid var(--sage-light);">📋 Detay</button>
                <button class="btn btn-secondary btn-sm" onclick="openScheduleModal('${client.id}')">📅 Program</button>
                <!-- Daha fazla menü -->
                <button class="btn btn-secondary btn-sm" onclick="toggleClientMenu('${client.id}')"
                    style="gap:5px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>
                    </svg>
                    Diğer
                </button>
                <div id="cmenu_${client.id}" style="display:none; position:absolute; right:0; bottom:calc(100% + 8px);
                     background:var(--surface); border:1.5px solid var(--border-soft); border-radius:var(--r-lg);
                     box-shadow:0 8px 32px rgba(45,51,64,.15); z-index:200; min-width:195px; overflow:hidden; padding:6px;">
                    <div style="padding:6px 10px 4px; font-size:10px; font-weight:700; text-transform:uppercase;
                         letter-spacing:.06em; color:var(--stone);">${client.name.split(' ')[0]}</div>
                    <button onclick="toggleClientMenu('${client.id}'); openWAComposer('${client.id}','session_reminder',{})"
                        style="display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px;
                               background:none; border:none; border-radius:var(--r-sm); cursor:pointer;
                               font-size:13px; color:var(--ink); text-align:left; transition:background .12s;"
                        onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='none'">
                        <span style="font-size:15px;">💬</span> WhatsApp Gönder
                    </button>
                    <button onclick="toggleClientMenu('${client.id}'); addClientMessage('${client.id}')"
                        style="display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px;
                               background:none; border:none; border-radius:var(--r-sm); cursor:pointer;
                               font-size:13px; color:var(--ink); text-align:left; transition:background .12s;"
                        onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='none'">
                        <span style="font-size:15px;">📝</span> Not Ekle
                    </button>

                    <button onclick="toggleClientMenu('${client.id}'); openClientDetail('${client.id}')"
                        style="display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px;
                               background:none; border:none; border-radius:var(--r-sm); cursor:pointer;
                               font-size:13px; color:var(--ink); text-align:left; transition:background .12s;"
                        onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='none'">
                        <span style="font-size:15px;">👤</span> Detay Görüntüle
                    </button>
                    <button onclick="toggleClientMenu('${client.id}'); toggleClientStatus('${client.id}')"
                        style="display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px;
                               background:none; border:none; border-radius:var(--r-sm); cursor:pointer;
                               font-size:13px; color:var(--ink); text-align:left; transition:background .12s;"
                        onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='none'">
                        <span style="font-size:15px;">${status === 'frozen' ? '▶️' : '⏸️'}</span>
                        ${status === 'frozen' ? 'Aktifleştir' : 'Dondur'}
                    </button>
                    <div style="height:1px; background:var(--border-soft); margin:4px 0;"></div>
                    <button onclick="toggleClientMenu('${client.id}'); deleteClient('${client.id}')"
                        style="display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px;
                               background:none; border:none; border-radius:var(--r-sm); cursor:pointer;
                               font-size:13px; color:var(--danger); text-align:left; transition:background .12s;"
                        onmouseover="this.style.background='rgba(217,128,137,.08)'" onmouseout="this.style.background='none'">
                        <span style="font-size:15px;">🗑</span> Sil
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function closeClientDetailModal() {
    const modal = document.getElementById("clientDetailModal");
    if (modal) modal.classList.remove("active");
}

function openClientDetail(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const clientSessions = sessions
        .filter(s => s.clientId === clientId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const clientPackages = packages.filter(p => p.clientId === clientId);
    const clientPayments = payments.filter(p => p.clientId === clientId);

    const getTypeClass = (type) => {
        if (!type) return 'default';
        const t = type.toLowerCase();
        if (t.includes('fizyoterapi')) return 'physio';
        if (t.includes('pilates')) return 'pilates';
        if (t.includes('yoga')) return 'yoga';
        return 'default';
    };

    let html = `
        <div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;">
            <div><strong>📱 Telefon:</strong> ${client.phone}</div>
            ${client.email ? `<div><strong>📧 E-posta:</strong> ${client.email}</div>` : ''}
            <div><strong>📅 Kayıt:</strong> ${client.createdAt ? new Date(client.createdAt).toLocaleDateString('tr-TR') : '-'}</div>
        </div>

        <h3 style="margin-bottom:12px;">📦 Paketler</h3>
        ${clientPackages.length
            ? clientPackages.map(p => `
                <div class="package-card" style="margin-bottom:10px;">
                    <div class="package-header">
                        <strong>${p.name}</strong>
                        <span class="badge ${p.status === 'active' ? 'badge-active' : 'badge-frozen'}">
                            ${p.status === 'active' ? 'Aktif' : 'Tamamlandı'}
                        </span>
                    </div>
                    <div style="font-size:13px; color:var(--stone);">
                        ${p.totalSessions - p.remainingSessions} / ${p.totalSessions} seans kullanıldı • 
                        ${p.paidAmount.toFixed(0)} / ${p.price.toFixed(0)} ₺ ödendi
                    </div>
                    <div class="package-progress">
                        <div class="package-progress-bar" style="width:${((p.totalSessions - p.remainingSessions) / p.totalSessions * 100)}%"></div>
                    </div>
                </div>`).join('')
            : '<p class="text-muted">Kayıtlı paket yok.</p>'
        }

        <div class="divider"></div>
        <h3 style="margin-bottom:12px;">📅 Seanslar</h3>
        ${clientSessions.length
            ? clientSessions.map(s => `
                <div class="session-item">
                    <div>
                        <span class="session-type-tag ${getTypeClass(s.type)}">${s.type}</span>
                        <span style="margin-left:8px; font-size:13px; color:var(--stone);">${s.duration} dk</span>
                    </div>
                    <div style="font-size:13px; color:var(--stone);">${s.date} ${s.time}</div>
                    <button class="btn btn-ghost btn-xs" onclick="deleteSession('${s.id}')">🗑</button>
                </div>`).join('')
            : '<p class="text-muted">Seans kaydı yok.</p>'
        }

        <div class="divider"></div>
        <h3 style="margin-bottom:12px;">💰 Ödemeler</h3>
        ${clientPayments.length
            ? `<table class="finance-table">
                <thead><tr><th>Tarih</th><th>Tutar</th><th>Yöntem</th></tr></thead>
                <tbody>
                ${clientPayments.map(pay => `
                    <tr>
                        <td>${new Date(pay.date).toLocaleDateString('tr-TR')}</td>
                        <td><strong style="color:var(--sage-dark)">+${pay.amount.toFixed(0)} ₺</strong></td>
                        <td>${pay.method || '—'}</td>
                    </tr>`).join('')}
                </tbody>
               </table>`
            : '<p class="text-muted">Ödeme kaydı yok.</p>'
        }
    `;

    const titleEl = document.getElementById("clientDetailTitle");
    const bodyEl = document.getElementById("clientDetailBody");
    const modal = document.getElementById("clientDetailModal");
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.innerHTML = `🌿 ${client.name}`;
    bodyEl.innerHTML = html;
    modal.classList.add("active");
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                       'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() || 7) + 1);

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'calendar-day-header';
        h.textContent = day;
        grid.appendChild(h);
    });

    const getEventClass = (type) => {
        if (!type) return 'default';
        const t = type.toLowerCase();
        if (t.includes('fizyoterapi')) return 'physio';
        if (t.includes('pilates')) return 'pilates';
        if (t.includes('yoga')) return 'yoga';
        return 'default';
    };

    const currentDate = new Date(startDate);
    for (let i = 0; i < 42; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (currentDate.getMonth() !== month) dayDiv.classList.add('other-month');
        const today = new Date();
        if (currentDate.toDateString() === today.toDateString()) dayDiv.classList.add('today');

        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = currentDate.getDate();
        dayDiv.appendChild(dayNumber);

        const dateStr =
            currentDate.getFullYear() + '-' +
            String(currentDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(currentDate.getDate()).padStart(2, '0');

        sessions.filter(s => s.date === dateStr).forEach(session => {
            const client = clients.find(c => c.id === session.clientId);
            if (client) {
                const ev = document.createElement('div');
                const status = session.status || 'normal';
                let cls = `calendar-event ${getEventClass(session.type)}`;
                let prefix = `${session.time} `;
                if (status === 'absent')    { cls = 'calendar-event absent';    prefix = '🚫 '; }
                else if (status === 'telafi')    { cls = 'calendar-event telafi';    prefix = '🔄 '; }
                else if (status === 'scheduled') { cls = 'calendar-event scheduled'; prefix = '📅 '; }
                ev.className = cls;
                ev.textContent = prefix + client.name.split(' ')[0];
                ev.title = `${client.name} — ${session.type}${status !== 'normal' ? ' [' + status.toUpperCase() + ']' : ''} (${session.duration} dk)`;
                dayDiv.appendChild(ev);
            }
        });

        grid.appendChild(dayDiv);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

function previousMonth() { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); }
function nextMonth()     { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); }
function goToToday()     { currentCalendarDate = new Date(); renderCalendar(); }

function renderPackages() {
    const container = document.getElementById('packagesList');

    if (clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <p>Henüz paket eklenmemiş</p>
            </div>`;
        return;
    }

    const items = clients.map(client => {
        const clientPackages = packages.filter(p => p.clientId === client.id);
        if (clientPackages.length === 0) return '';

        return `
        <div class="client-card">
            <div class="client-name-row" style="margin-bottom:14px;">
                <span class="client-name">${client.name}</span>
                <span class="text-muted text-small">📱 ${client.phone}</span>
            </div>
            ${clientPackages.map(pkg => {
                const used = pkg.totalSessions - pkg.remainingSessions;
                const pct = Math.round((used / pkg.totalSessions) * 100);
                const remaining = (pkg.price || 0) - (pkg.paidAmount || 0);
                const barClass = pct >= 80 ? 'danger' : pct >= 60 ? 'warning' : '';
                return `
                <div class="package-card">
                    <div class="package-header">
                        <div>
                            <strong>${pkg.name}</strong>
                            <span class="badge ${pkg.status === 'active' ? 'badge-active' : 'badge-frozen'}" style="margin-left:8px;">
                                ${pkg.status === 'active' ? '✓ Aktif' : 'Tamamlandı'}
                            </span>
                            ${pkg.instructorId ? (() => {
                                const ins = instructors.find(i => i.id === pkg.instructorId);
                                return ins ? `<span style="margin-left:8px; padding:2px 9px; background:rgba(184,169,212,.15); color:var(--lav-dark);
                                    border-radius:99px; font-size:11px; font-weight:600;">👩‍🏫 ${ins.name}</span>` : '';
                            })() : ''}
                        </div>
                        <div style="text-align:right; font-size:13px; color:var(--stone);">
                            ${pkg.startDate ? new Date(pkg.startDate).toLocaleDateString('tr-TR') : ''}
                        </div>
                    </div>
                    <div style="font-size:13px; color:var(--ink-soft); margin-bottom:4px;">
                        <span>📊 ${used} / ${pkg.totalSessions} seans</span>
                        <span style="margin-left:14px;">💳 ${(pkg.paidAmount||0).toFixed(0)} / ${pkg.price.toFixed(0)} ₺</span>
                        ${remaining > 0 ? `<span style="color:var(--danger); margin-left:14px;">⚠ Kalan: ${remaining.toFixed(0)} ₺</span>` : ''}
                    </div>
                    <div class="package-progress">
                        <div class="package-progress-bar ${barClass}" style="width:${pct}%"></div>
                    </div>
                    <div class="flex gap-1" style="margin-top:10px;">
                        ${remaining > 0
                            ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal('${pkg.id}')">💳 Ödeme Al</button>
                               <button class="btn btn-lavender btn-sm" onclick="openInstallmentModal('${pkg.id}')">📅 Taksit</button>`
                            : ''}
                        <button class="btn btn-danger btn-sm" onclick="deletePackage('${pkg.id}')">🗑 Sil</button>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    }).filter(Boolean).join('');

    container.innerHTML = items || `
        <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <p>Henüz paket eklenmemiş</p>
        </div>`;
}

function openFinanceModal(title, content) {
    const modal  = document.getElementById("financeModal");
    const titleEl = document.getElementById("financeModalTitle");
    const bodyEl  = document.getElementById("financeModalBody");
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.innerHTML = title;
    bodyEl.innerHTML  = content;
    modal.classList.add("active");
}

function closeFinanceModal() {
    const modal = document.getElementById("financeModal");
    if (modal) modal.classList.remove("active");
}

function openMonthlyIncome() {
    const now   = new Date();
    const month = now.getMonth(), year = now.getFullYear();
    const list  = payments.filter(p => { const d = new Date(p.date); return d.getMonth()===month && d.getFullYear()===year; });
    const total = list.reduce((s, p) => s + p.amount, 0);

    const rows = list.map(p => {
        const c = clients.find(c => c.id === p.clientId);
        return `<tr>
            <td>${new Date(p.date).toLocaleDateString('tr-TR')}</td>
            <td>${c ? c.name : '—'}</td>
            <td><strong style="color:var(--sage-dark)">${p.amount.toFixed(0)} ₺</strong></td>
            <td>${p.method || '—'}</td>
        </tr>`;
    }).join('');

    openFinanceModal(`📅 Bu Ayın Geliri — ${total.toFixed(0)} ₺`,
        `<table class="finance-table">
            <thead><tr><th>Tarih</th><th>Danışan</th><th>Tutar</th><th>Yöntem</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--stone);">Kayıt yok</td></tr>'}</tbody>
         </table>`);
}

function openTotalIncome() {
    const total = payments.reduce((s, p) => s + p.amount, 0);
    const rows  = [...payments].sort((a,b) => new Date(b.date)-new Date(a.date)).map(p => {
        const c = clients.find(c => c.id === p.clientId);
        return `<tr>
            <td>${new Date(p.date).toLocaleDateString('tr-TR')}</td>
            <td>${c ? c.name : '—'}</td>
            <td><strong style="color:var(--sage-dark)">${p.amount.toFixed(0)} ₺</strong></td>
            <td>${p.method || '—'}</td>
        </tr>`;
    }).join('');

    openFinanceModal(`💰 Tüm Gelirler — ${total.toFixed(0)} ₺`,
        `<table class="finance-table">
            <thead><tr><th>Tarih</th><th>Danışan</th><th>Tutar</th><th>Yöntem</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--stone);">Kayıt yok</td></tr>'}</tbody>
         </table>`);
}

function openPendingPayments() {
    const pending = packages
        .map(p => ({ name: clients.find(c => c.id === p.clientId)?.name || '—', pkg: p.name, debt: (p.price||0)-(p.paidAmount||0), id: p.id }))
        .filter(x => x.debt > 0);

    if (!pending.length) { openFinanceModal("⚠️ Bekleyen Ödemeler", "<p style='color:var(--sage-dark)'>✓ Bekleyen ödeme yok!</p>"); return; }

    const rows = pending.map(p =>
        `<tr><td>${p.name}</td><td>${p.pkg}</td><td><strong style="color:var(--danger)">${p.debt.toFixed(0)} ₺</strong></td></tr>`
    ).join('');

    openFinanceModal("⚠️ Bekleyen Ödemeler",
        `<table class="finance-table">
            <thead><tr><th>Danışan</th><th>Paket</th><th>Kalan Borç</th></tr></thead>
            <tbody>${rows}</tbody>
         </table>`);
}

function renderFinance() {
    const now   = new Date();
    const thisM = now.getMonth(), thisY = now.getFullYear();
    const lastM = thisM === 0 ? 11 : thisM - 1;
    const lastY = thisM === 0 ? thisY - 1 : thisY;

    const inMonth = (date, m, y) => { const d = new Date(date); return d.getMonth()===m && d.getFullYear()===y; };

    const thisMonthPays = payments.filter(p => inMonth(p.date, thisM, thisY));
    const lastMonthPays = payments.filter(p => inMonth(p.date, lastM, lastY));
    const monthlyIncome = thisMonthPays.reduce((s,p) => s+p.amount, 0);
    const lastIncome    = lastMonthPays.reduce((s,p) => s+p.amount, 0);
    const totalIncome   = payments.reduce((s,p) => s+p.amount, 0);
    const debts         = packages.filter(p => (p.price||0) > (p.paidAmount||0));
    const totalDebt     = debts.reduce((s,p) => s+((p.price||0)-(p.paidAmount||0)), 0);
    const totalExpAmt   = (typeof expenses !== 'undefined' ? expenses : []).reduce((s,e) => s+e.amount, 0);
    const expectedAmt   = packages.reduce((s,p) => s+(p.price||0), 0);

    // KPI kartları
    document.getElementById('monthlyIncome').textContent  = monthlyIncome.toFixed(0) + ' ₺';
    document.getElementById('totalIncome').textContent    = totalIncome.toFixed(0) + ' ₺';
    document.getElementById('totalDebt').textContent      = totalDebt.toFixed(0) + ' ₺';
    const expEl = document.getElementById('totalExpense');
    if (expEl) expEl.textContent = totalExpAmt.toFixed(0) + ' ₺';
    const expInc = document.getElementById('expectedIncome');
    if (expInc) expInc.textContent = expectedAmt.toFixed(0) + ' ₺';
    const expDesc = document.getElementById('expectedDesc');
    if (expDesc) expDesc.textContent = packages.length + ' paket toplam';

    // Alt bilgiler
    const changeEl = document.getElementById('monthlyChange');
    if (changeEl) {
        if (lastIncome > 0) {
            const pct   = ((monthlyIncome - lastIncome) / lastIncome * 100).toFixed(0);
            const up    = monthlyIncome >= lastIncome;
            changeEl.innerHTML = `<span style="color:${up?'var(--success)':'var(--danger)'};">${up?'▲':'▼'} ${Math.abs(pct)}%</span> geçen aya göre`;
        } else {
            changeEl.textContent = 'İlk ay verisi';
        }
    }
    const tcEl = document.getElementById('totalPaymentCount');
    if (tcEl) tcEl.textContent = payments.length + ' ödeme kaydı';
    const dcEl = document.getElementById('debtClientCount');
    if (dcEl) dcEl.textContent = debts.length + ' danışan bekliyor';

    // Ay filtresi seçeneklerini doldur
    const monthSel = document.getElementById('financeFilterMonth');
    if (monthSel && monthSel.options.length <= 1) {
        const months = [...new Set(payments.map(p => p.date?.slice(0,7)))].sort().reverse();
        months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            const [y, mo] = m.split('-');
            const names = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
            opt.textContent = names[parseInt(mo)-1] + ' ' + y;
            monthSel.appendChild(opt);
        });
    }

    // Grafikleri çiz
    renderFinanceCharts();

    // Borçlu listesi
    renderDebtList(debts);

    // Ödeme geçmişi
    renderPaymentHistory();

    // Accordion'ları kapat
    setTimeout(initAccordions, 50);
}

function renderDebtList(debtsArg) {
    const el = document.getElementById('debtList');
    if (!el) return;

    // Arama filtresi
    const searchVal = (document.getElementById('debtSearch')?.value || '').toLowerCase().trim();

    // HER ZAMAN paketlerden kendi hesapla — tutarlı veri yapısı için
    // (debtsArg parametresi geriye dönük uyumluluk için yok sayılıyor, kendi hesaplıyoruz)
    let debts = packages
        .map(p => ({
            pkg:   p,
            client: clients.find(c => c.id === p.clientId),
            debt:  (p.price || 0) - (p.paidAmount || 0)
        }))
        .filter(x => x.debt > 0 && x.client);

    // Arama uygula
    if (searchVal) {
        debts = debts.filter(x => (x.client.name || '').toLowerCase().includes(searchVal));
    }

    // Badge
    const badge = document.getElementById('debtCountBadge');
    if (badge) badge.textContent = debts.length ? '(' + debts.length + ')' : '';

    if (!debts.length) {
        el.innerHTML = '<div style="padding:20px; text-align:center; color:var(--stone); font-size:14px;">' +
            (searchVal ? 'Sonuç bulunamadı' : '✓ Bekleyen ödeme yok') + '</div>';
        return;
    }

    window._debtMap = {};
    const rows = debts.map((x, i) => {
        const c    = x.client;
        const p    = x.pkg;
        const debt = x.debt;
        const pct  = Math.round((p.paidAmount || 0) / (p.price || 1) * 100);
        const sym  = p.priceCurrency === 'USD' ? '$' : p.priceCurrency === 'EUR' ? '€' : p.priceCurrency === 'GBP' ? '£' : '₺';

        window._debtMap[i] = { client: c, pkg: p, debt };

        return '<tr>' +
            '<td><strong>' + c.name + '</strong></td>' +
            '<td style="color:var(--stone); font-size:13px;">' + (p.name || '—') + '</td>' +
            '<td>' + sym + (p.price || 0).toFixed(0) + '</td>' +
            '<td>' +
                '<div style="display:flex; align-items:center; gap:6px;">' +
                    '<div style="width:60px; height:5px; background:var(--border); border-radius:99px; overflow:hidden;">' +
                        '<div style="height:100%; width:' + pct + '%; background:var(--sage); border-radius:99px;"></div>' +
                    '</div>' +
                    '<span style="font-size:12px; color:var(--stone);">' + sym + (p.paidAmount || 0).toFixed(0) + '</span>' +
                '</div>' +
            '</td>' +
            '<td><strong style="color:var(--danger);">' + sym + debt.toFixed(0) + '</strong></td>' +
            '<td>' +
                '<div style="display:flex; gap:6px;">' +
                    '<button class="btn btn-success btn-xs" onclick="openPaymentModal(\'' + p.id + '\')">💳 Al</button>' +
                    '<button class="btn btn-ghost btn-xs" onclick="window._sendDebtReminder && window._sendDebtReminder(' + i + ')">💬</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    }).join('');

    el.innerHTML = '<table class="finance-table">' +
        '<thead><tr><th>Danışan</th><th>Paket</th><th>Toplam</th><th>Ödenen</th><th>Kalan</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
    '</table>';
}

function renderPaymentHistory() {
    const container = document.getElementById('paymentHistory');
    if (!container) return;

    const methodFilter = document.getElementById('financeFilterMethod')?.value || 'all';
    const monthFilter  = document.getElementById('financeFilterMonth')?.value  || 'all';
    const searchVal    = (document.getElementById('financeSearch')?.value || '').toLowerCase().trim();
    const fromDate     = document.getElementById('financeFromDate')?.value || '';
    const toDate       = document.getElementById('financeToDate')?.value   || '';

    let filtered = [...payments].sort((a,b) => new Date(b.date)-new Date(a.date));
    if (methodFilter !== 'all') filtered = filtered.filter(p => p.method === methodFilter);
    if (monthFilter  !== 'all') filtered = filtered.filter(p => p.date?.startsWith(monthFilter));
    if (fromDate)               filtered = filtered.filter(p => p.date >= fromDate);
    if (toDate)                 filtered = filtered.filter(p => p.date <= toDate);
    if (searchVal) {
        filtered = filtered.filter(p => {
            const c = clients.find(c => c.id === p.clientId);
            return c && c.name.toLowerCase().includes(searchVal);
        });
    }

    // Filtre özeti + badge güncelle
    const summaryEl = document.getElementById('financeFilterSummary');
    const hasFilter  = methodFilter !== 'all' || monthFilter !== 'all' || searchVal || fromDate || toDate;
    const totalFiltered = filtered.reduce((s,p) => s+p.amount, 0);
    const payBadge = document.getElementById('paymentCountBadge');
    if (payBadge) payBadge.textContent = filtered.length ? '(' + filtered.length + ')' : '';

    if (summaryEl) {
        if (hasFilter && filtered.length > 0) {
            let rangeLabel = '';
            if (fromDate && toDate) {
                rangeLabel = new Date(fromDate).toLocaleDateString('tr-TR') + ' — ' + new Date(toDate).toLocaleDateString('tr-TR');
            } else if (fromDate) {
                rangeLabel = new Date(fromDate).toLocaleDateString('tr-TR') + ' sonrası';
            } else if (toDate) {
                rangeLabel = new Date(toDate).toLocaleDateString('tr-TR') + ' öncesi';
            }
            summaryEl.style.display = 'flex';
            summaryEl.style.alignItems = 'center';
            summaryEl.style.justifyContent = 'space-between';
            summaryEl.style.flexWrap = 'wrap';
            summaryEl.style.gap = '8px';
            summaryEl.innerHTML =
                '<div>' +
                    '<div style="font-size:11px; font-weight:600; color:var(--sage-dark); text-transform:uppercase; letter-spacing:.05em;">' +
                        (rangeLabel || 'Filtrelenmiş Sonuç') +
                    '</div>' +
                    '<div style="font-size:13px; color:var(--ink-soft); margin-top:2px;">' + filtered.length + ' ödeme bulundu</div>' +
                '</div>' +
                '<div style="font-family:\'Playfair Display\',serif; font-size:1.8rem; font-weight:600; color:var(--sage-dark);">' +
                    (typeof formatCurrency === 'function' ? formatCurrency(totalFiltered) : totalFiltered.toFixed(0) + ' ₺') +
                '</div>';
        } else {
            summaryEl.style.display = 'none';
        }
    }

    if (!filtered.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>Ödeme bulunamadı</p>' +
            (hasFilter ? '<span>Filtreleri temizleyin</span>' : '') + '</div>';
        return;
    }

    container.innerHTML = `
        <table class="finance-table">
            <thead>
                <tr><th>Tarih</th><th>Danışan</th><th>Paket</th><th>Yöntem</th><th style="text-align:right;">Tutar</th><th></th></tr>
            </thead>
            <tbody>
            ${filtered.map((pay, i) => {
                const c   = clients.find(c => c.id === pay.clientId);
                const pkg = packages.find(p => p.id === pay.packageId);
                window._payMap = window._payMap || {};
                window._payMap[i] = { payment: pay, client: c, pkg };
                return `<tr>
                    <td style="color:var(--stone); font-size:13px;">${new Date(pay.date).toLocaleDateString('tr-TR')}</td>
                    <td><strong>${c ? c.name : '—'}</strong></td>
                    <td style="color:var(--stone); font-size:13px;">${pkg ? pkg.name : '—'}</td>
                    <td>
                        <span style="display:inline-flex; align-items:center; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600;
                            background:${pay.method==='Nakit'?'rgba(109,184,157,.12)':pay.method==='Kredi Kartı'?'rgba(184,169,212,.15)':'rgba(143,173,161,.12)'};
                            color:${pay.method==='Nakit'?'var(--sage-dark)':pay.method==='Kredi Kartı'?'var(--lav-dark)':'var(--ink-soft)'};">
                            ${pay.method || '—'}
                        </span>
                    </td>
                    <td style="text-align:right;"><strong style="color:var(--sage-dark);">+${pay.amount.toFixed(0)} ₺</strong></td>
                    <td>
                        <button class="btn btn-ghost btn-xs" title="Makbuz"
                            onclick="if(window._payMap&&window._payMap[${i}]){const x=window._payMap[${i}];generateReceiptPDF(x.payment,x.client,x.pkg);}">
                            🖨️
                        </button>
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>`;
}

let _financeChartInstances = {};

function renderFinanceCharts() {
    if (typeof Chart === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        s.onload = _drawFinanceCharts;
        document.head.appendChild(s);
    } else {
        _drawFinanceCharts();
    }
}

function _drawFinanceCharts() {
    const now = new Date();
    const thisM = now.getMonth(), thisY = now.getFullYear();

    // Son 6 ay verileri
    const last6 = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(thisY, thisM - i, 1);
        const m = d.getMonth(), y = d.getFullYear();
        const inc = payments
            .filter(p => { const pd = new Date(p.date); return pd.getMonth()===m && pd.getFullYear()===y; })
            .reduce((s,p) => s+p.amount, 0);
        const label = d.toLocaleDateString('tr-TR', {month:'short'});
        last6.push({ label, inc, isCurrent: i===0 });
    }

    // Bar chart
    const barCtx = document.getElementById('financeBarChart');
    if (barCtx) {
        if (_financeChartInstances.bar) _financeChartInstances.bar.destroy();
        _financeChartInstances.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: last6.map(r => r.label),
                datasets: [{
                    data: last6.map(r => r.inc),
                    backgroundColor: last6.map(r => r.isCurrent ? '#5f8076' : 'rgba(143,173,161,.45)'),
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                    y: { grid: { color: '#f0ece7' }, ticks: { callback: v => v.toLocaleString('tr-TR') + '₺', font: { size: 11 } } }
                }
            }
        });
    }

    // Method doughnut
    const methodMap = {};
    payments.forEach(p => { const m = p.method || 'Diğer'; methodMap[m] = (methodMap[m]||0)+1; });
    const methodCtx = document.getElementById('financeMethodChart');
    if (methodCtx && Object.keys(methodMap).length) {
        if (_financeChartInstances.method) _financeChartInstances.method.destroy();
        _financeChartInstances.method = new Chart(methodCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(methodMap),
                datasets: [{ data: Object.values(methodMap),
                    backgroundColor: ['#8fada1','#b8a9d4','#e8b4b8','#e8c47c','#7ba8d0'],
                    borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { padding:8, font: { size:11 } } } },
                cutout: '62%'
            }
        });
    }
}

function updateStats() {
    document.getElementById('totalClients').textContent = clients.length;
    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('activePackages').textContent = packages.filter(p => p.status === 'active').length;

    const now = new Date();
    const thisMonth = sessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('thisMonthSessions').textContent = thisMonth;
}

// ========================================
// UTILITIES
// ========================================

function clearFilters() {
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    const fs = document.getElementById('filterStatus');
    if (fs) fs.value = 'all';
    const ft = document.getElementById('filterSessionType');
    if (ft) ft.value = 'all';
    const fp = document.getElementById('filterPayment');
    if (fp) fp.value = 'all';
    renderClients();
}

window.onclick = function(event) {
    ['addClientModal', 'addSessionModal', 'addPackageModal', 'paymentModal', 'financeModal', 'clientDetailModal'].forEach(id => {
        const m = document.getElementById(id);
        if (event.target === m) m.classList.remove('active');
    });
};

console.log('✅ app.js yüklendi (yeni tasarım)');

// ================================
// GLOBAL EXPORTS
// ================================
window.logoutUser            = () => logout();
window.showNotification      = showNotification;
window.switchTab             = switchTab;
window.openAddClientModal    = openAddClientModal;
window.closeAddClientModal   = closeAddClientModal;
window.openAddSessionModal   = openAddSessionModal;
window.closeAddSessionModal  = closeAddSessionModal;
window.openAddPackageModal   = openAddPackageModal;
window.closeAddPackageModal  = closeAddPackageModal;
window.openPaymentModal      = openPaymentModal;
window.closePaymentModal     = closePaymentModal;
window.saveClient            = saveClient;
window.saveSession           = saveSession;
window.savePackage           = savePackage;
window.savePayment           = savePayment;
window.deleteClient          = deleteClient;
window.deleteSession         = deleteSession;
window.deletePackage         = deletePackage;
window.previousMonth         = previousMonth;
window.nextMonth             = nextMonth;
window.goToToday             = goToToday;
window.clearFilters          = clearFilters;
window.renderClients         = renderClients;
window.renderPackages        = renderPackages;
window.renderFinance         = renderFinance;
window.renderCalendar        = renderCalendar;
window.renderPriceList       = renderPriceList;
window.renderPaymentHistory  = renderPaymentHistory;
window.renderDebtList        = renderDebtList;
window.updateStats           = updateStats;
window.checkSessionConflict  = checkSessionConflict;
window.logout                = logout;
window.addClientMessage      = addClientMessage;
window.toggleClientStatus    = toggleClientStatus;
window.openMonthlyIncome     = openMonthlyIncome;
window.openTotalIncome       = openTotalIncome;
window.openPendingPayments   = openPendingPayments;
window.openFinanceModal      = openFinanceModal;
window.closeFinanceModal     = closeFinanceModal;
window.openClientDetail      = openClientDetail;
window.closeClientDetailModal = closeClientDetailModal;

// ─── GLOBAL VERİ REFERANSLARI (dashboard.js / notifications.js için) ────
function syncGlobalDataRefs() {
    window.clientsData  = clients;
    window.sessionsData = sessions;
    window.packagesData = packages;
    window.paymentsData = payments;
}

// ─── BİLDİRİM ROZET SAYACI ──────────────────────────────────
function updateNotifBadge() {
    const badge = document.getElementById('notifCount');
    if (!badge) return;

    // Yarınki seanslar
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.getFullYear() + '-' +
        String(tomorrow.getMonth()+1).padStart(2,'0') + '-' +
        String(tomorrow.getDate()).padStart(2,'0');
    const tomorrowCount = sessions.filter(s => s.date === tStr).length;

    // Bekleyen ödemeler
    const debtCount = packages.filter(p => (p.price||0) > (p.paidAmount||0)).length;

    // Doğum günleri
    const today = new Date();
    const todayMD = String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const bdayCount = clients.filter(c => c.birthdate && c.birthdate.slice(5) === todayMD).length;

    const total = tomorrowCount + debtCount + bdayCount;
    if (total > 0) {
        badge.textContent = total > 9 ? '9+' : total;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

window.syncGlobalDataRefs = syncGlobalDataRefs;
window.updateNotifBadge   = updateNotifBadge;

window.checkMorningReminder = typeof checkMorningReminder !== "undefined" ? checkMorningReminder : ()=>{};

// ============================================================
// MENÜ TOGGLE
// ============================================================
function toggleClientMenu(clientId) {
    const menu = document.getElementById('cmenu_' + clientId);
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    // Tüm açık menüleri kapat
    document.querySelectorAll('[id^="cmenu_"]').forEach(m => m.style.display = 'none');
    if (!isOpen) {
        menu.style.display = 'block';
        // Dışarı tıklayınca kapat
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!menu.contains(e.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', handler);
                }
            });
        }, 10);
    }
}
window.toggleClientMenu = toggleClientMenu;

// ============================================================
// DEVAMSIZLIK SİSTEMİ
// ============================================================
function openAbsenceModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = document.getElementById('absenceModal');
    if (existing) existing.remove();

    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const today = d.toISOString().split('T')[0];

    const modal = document.createElement('div');
    modal.id = 'absenceModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;">
            <div class="modal-header">
                <h3>🚫 Devamsızlık Kaydı</h3>
                <button class="close-btn" onclick="document.getElementById('absenceModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="payment-info-box" style="margin-bottom:18px;">
                    <strong>${client.name}</strong>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Tarih *</label>
                        <input type="date" id="absDate" value="${today}">
                    </div>
                    <div class="form-group">
                        <label>Saat</label>
                        <input type="time" id="absTime" value="09:00">
                    </div>
                </div>

                <div class="form-group">
                    <label>Seans Türü</label>
                    <select id="absType">
                        <option>Fizyoterapi</option>
                        <option>Reformer Pilates</option>
                        <option>Yoga</option>
                        <option>Mat Pilates</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Gelmeme Sebebi</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                        ${['Hastalık','İş / Yoğunluk','Unuttu','Aile / Acil','Tatil','Diğer'].map((r,i) => `
                        <label style="display:flex; align-items:center; gap:8px; padding:9px 12px;
                               background:var(--surface-2); border-radius:var(--r-sm); cursor:pointer;
                               border:1.5px solid var(--border); transition:all .15s;"
                               id="absReasonLabel_${i}">
                            <input type="radio" name="absReason" value="${r}"
                                onchange="document.querySelectorAll('[id^=absReasonLabel_]').forEach(l=>l.style.borderColor='var(--border)'); this.closest('label').style.borderColor='var(--sage-dark)';"
                                style="accent-color:var(--sage-dark);">
                            <span style="font-size:13px;">${r}</span>
                        </label>`).join('')}
                    </div>
                </div>

                <div class="form-group">
                    <label>Bu ders paketten düşülsün mü?</label>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <label style="display:flex; align-items:center; gap:8px; padding:10px 16px;
                               background:var(--surface-2); border-radius:var(--r-sm); cursor:pointer;
                               border:1.5px solid var(--border); flex:1; transition:all .15s;">
                            <input type="radio" name="absCount" value="sayilsin" checked
                                onchange="document.getElementById('telafi_row').style.display='none';"
                                style="accent-color:var(--sage-dark);">
                            <div>
                                <div style="font-size:13px; font-weight:600;">Evet, düşülsün</div>
                                <div style="font-size:11px; color:var(--stone);">Ders yapıldı sayılır</div>
                            </div>
                        </label>
                        <label style="display:flex; align-items:center; gap:8px; padding:10px 16px;
                               background:var(--surface-2); border-radius:var(--r-sm); cursor:pointer;
                               border:1.5px solid var(--border); flex:1; transition:all .15s;">
                            <input type="radio" name="absCount" value="sayilmasin"
                                onchange="document.getElementById('telafi_row').style.display='block';"
                                style="accent-color:var(--sage-dark);">
                            <div>
                                <div style="font-size:13px; font-weight:600;">Hayır, düşülmesin</div>
                                <div style="font-size:11px; color:var(--stone);">Telafi planla</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div id="telafi_row" style="display:none;">
                    <div class="form-group">
                        <label>Telafi Tarihi (opsiyonel)</label>
                        <input type="date" id="absTelafiDate">
                        <div class="form-hint">Doldurmadan kaydedebilirsiniz, sonra seans olarak eklersiniz.</div>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom:0;">
                    <label>Not</label>
                    <textarea id="absNote" rows="2" placeholder="Ek açıklama..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('absenceModal').remove()">İptal</button>
                <button class="btn btn-danger" onclick="saveAbsence('${clientId}')">🚫 Kaydet</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function saveAbsence(clientId) {
    if (!currentUser) { alert('Lütfen giriş yapın'); return; }

    const date      = document.getElementById('absDate')?.value;
    const time      = document.getElementById('absTime')?.value || '09:00';
    const type      = document.getElementById('absType')?.value;
    const reasonEl  = document.querySelector('input[name="absReason"]:checked');
    const countEl   = document.querySelector('input[name="absCount"]:checked');
    const telafiDate= document.getElementById('absTelafiDate')?.value || '';
    const note      = document.getElementById('absNote')?.value.trim() || '';

    if (!date) { showNotification('Tarih zorunlu', 'error'); return; }

    const sayilsin  = countEl?.value === 'sayilsin';
    const reason    = reasonEl?.value || 'Belirtilmedi';

    // Devamsızlık seansı kaydet (status: 'absent')
    const session = {
        id:         'abs-' + Date.now(),
        clientId,
        date,
        time,
        type,
        duration:   60,
        notes:      `[DEVAMSIZLIK — ${reason}] ${note}`.trim(),
        status:     'absent',
        absenceReason: reason,
        countAsSession: sayilsin,
        telafiDate,
        createdAt:  new Date().toISOString()
    };

    await upsertSession(currentUser.uid, session.id, session);

    // Paket düşme — sadece "sayılsın" seçildiyse
    if (sayilsin) {
        const pkg = packages.find(p => p.clientId === clientId && p.status === 'active');
        if (pkg && typeof pkg.remainingSessions === 'number' && pkg.remainingSessions > 0) {
            const newRem = pkg.remainingSessions - 1;
            await fbUpdatePackage(currentUser.uid, pkg.id, {
                remainingSessions: newRem,
                status: newRem === 0 ? 'completed' : pkg.status
            });
        }
    }

    // Telafi seansı varsa takvime ekle
    if (!sayilsin && telafiDate) {
        const telafiSession = {
            id:       'telafi-' + Date.now(),
            clientId,
            date:     telafiDate,
            time,
            type,
            duration: 60,
            notes:    `[TELAFİ — ${date} tarihli devamsızlık]`,
            status:   'telafi',
            createdAt: new Date().toISOString()
        };
        await upsertSession(currentUser.uid, telafiSession.id, telafiSession);
    }

    await loadDataFromFirestore(currentUser.uid);
    syncGlobalDataRefs();
    renderClients();
    renderCalendar();
    updateStats();
    document.getElementById('absenceModal')?.remove();

    const msg = sayilsin
        ? `Devamsızlık kaydedildi (paketten düşüldü)`
        : telafiDate
            ? `Devamsızlık kaydedildi — Telafi ${new Date(telafiDate).toLocaleDateString('tr-TR')} tarihine eklendi`
            : `Devamsızlık kaydedildi (paketten düşülmedi)`;
    showNotification(msg, 'success');
}

window.openAbsenceModal = openAbsenceModal;
window.saveAbsence      = saveAbsence;

// ============================================================
// HAFTALIK PROGRAM SİSTEMİ
// ============================================================
const DAYS_TR = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];

function openScheduleModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const existing = document.getElementById('scheduleModal');
    if (existing) existing.remove();

    // Mevcut program varsa yükle
    const schedule = client.weeklySchedule || [];

    const modal = document.createElement('div');
    modal.id = 'scheduleModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:540px;">
            <div class="modal-header">
                <h3>📅 Haftalık Program</h3>
                <button class="close-btn" onclick="document.getElementById('scheduleModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="payment-info-box" style="margin-bottom:20px;">
                    <strong>${client.name}</strong> — Haftalık seans programı
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;" id="scheduleRows">
                    ${DAYS_TR.map((day, i) => {
                        const existing = schedule.find(s => s.dayIndex === i);
                        return `
                        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px;
                             background:var(--surface-2); border-radius:var(--r-sm); border:1.5px solid var(--border-soft);"
                             id="schedRow_${i}">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex-shrink:0; min-width:110px;">
                                <input type="checkbox" id="schedDay_${i}" value="${i}"
                                    ${existing ? 'checked' : ''}
                                    onchange="toggleSchedRow(${i})"
                                    style="accent-color:var(--sage-dark); width:16px; height:16px;">
                                <span style="font-size:13px; font-weight:600;">${day}</span>
                            </label>
                            <input type="time" id="schedTime_${i}" value="${existing?.time || '09:00'}"
                                style="flex:1; padding:7px 10px; border:1.5px solid var(--border); border-radius:var(--r-sm);
                                       font-size:13px; ${!existing ? 'opacity:.4; pointer-events:none;' : ''}">
                            <select id="schedType_${i}"
                                style="flex:1.5; padding:7px 10px; border:1.5px solid var(--border); border-radius:var(--r-sm);
                                       font-size:13px; ${!existing ? 'opacity:.4; pointer-events:none;' : ''}">
                                <option ${existing?.type==='Fizyoterapi'?'selected':''}>Fizyoterapi</option>
                                <option ${existing?.type==='Reformer Pilates'?'selected':''}>Reformer Pilates</option>
                                <option ${existing?.type==='Yoga'?'selected':''}>Yoga</option>
                                <option ${existing?.type==='Mat Pilates'?'selected':''}>Mat Pilates</option>
                            </select>
                        </div>`;
                    }).join('')}
                </div>

                <div style="margin-top:18px; padding:14px 16px; background:var(--surface-2);
                     border-radius:var(--r-md); border:1px solid var(--border-soft);">
                    <div style="font-size:13px; font-weight:600; color:var(--ink); margin-bottom:10px;">🗓️ Otomatik Seans Üretimi</div>
                    <div class="form-row">
                        <div class="form-group" style="margin-bottom:0;">
                            <label>Başlangıç Tarihi</label>
                            <input type="date" id="schedFrom" value="${new Date().toISOString().slice(0,10)}">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label>Bitiş Tarihi</label>
                            <input type="date" id="schedTo" value="${getDatePlusWeeks(4)}">
                        </div>
                    </div>
                    <div class="form-hint" style="margin-top:8px;">Seçili günlere bu tarih aralığında otomatik seans oluşturulur.</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('scheduleModal').remove()">İptal</button>
                <button class="btn btn-primary" onclick="saveSchedule('${clientId}')">💾 Kaydet</button>
                <button class="btn btn-success" onclick="generateSessionsFromSchedule('${clientId}')">⚡ Kaydet & Seans Üret</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function toggleSchedRow(i) {
    const checked = document.getElementById('schedDay_' + i)?.checked;
    const timeEl  = document.getElementById('schedTime_' + i);
    const typeEl  = document.getElementById('schedType_' + i);
    if (timeEl) { timeEl.style.opacity = checked ? '1' : '.4'; timeEl.style.pointerEvents = checked ? 'auto' : 'none'; }
    if (typeEl) { typeEl.style.opacity = checked ? '1' : '.4'; typeEl.style.pointerEvents = checked ? 'auto' : 'none'; }
}

function getDatePlusWeeks(weeks) {
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().slice(0, 10);
}

function buildScheduleData() {
    const schedule = [];
    for (let i = 0; i < 7; i++) {
        const checked = document.getElementById('schedDay_' + i)?.checked;
        if (!checked) continue;
        schedule.push({
            dayIndex: i,  // 0=Pzt … 6=Paz
            time: document.getElementById('schedTime_' + i)?.value || '09:00',
            type: document.getElementById('schedType_' + i)?.value || 'Fizyoterapi'
        });
    }
    return schedule;
}

async function saveSchedule(clientId) {
    if (!currentUser) { alert('Lütfen giriş yapın'); return; }
    const schedule = buildScheduleData();
    await fbUpdateClient(currentUser.uid, clientId, { weeklySchedule: schedule });
    await loadDataFromFirestore(currentUser.uid);
    syncGlobalDataRefs();
    renderClients();
    document.getElementById('scheduleModal')?.remove();
    showNotification('Haftalık program kaydedildi ✓', 'success');
}

async function generateSessionsFromSchedule(clientId) {
    if (!currentUser) { alert('Lütfen giriş yapın'); return; }

    const schedule  = buildScheduleData();
    if (!schedule.length) { showNotification('En az bir gün seçin', 'warning'); return; }

    const fromStr   = document.getElementById('schedFrom')?.value;
    const toStr     = document.getElementById('schedTo')?.value;
    if (!fromStr || !toStr) { showNotification('Tarih aralığı seçin', 'warning'); return; }

    const from = new Date(fromStr);
    const to   = new Date(toStr);
    if (to <= from)  { showNotification('Bitiş tarihi başlangıçtan sonra olmalı', 'warning'); return; }

    // JS'de getDay(): 0=Pazar, 1=Pzt … 6=Cmt
    // Bizim dayIndex: 0=Pzt … 6=Paz  → dönüşüm:
    const jsDayOf = (dayIndex) => dayIndex === 6 ? 0 : dayIndex + 1;

    const newSessions = [];
    const cur = new Date(from);
    while (cur <= to) {
        const jsDay = cur.getDay();
        const match = schedule.find(s => jsDayOf(s.dayIndex) === jsDay);
        if (match) {
            const dateStr = cur.getFullYear() + '-' +
                String(cur.getMonth()+1).padStart(2,'0') + '-' +
                String(cur.getDate()).padStart(2,'0');
            // Aynı tarihte zaten seans var mı?
            const alreadyExists = sessions.some(s => s.clientId === clientId && s.date === dateStr && s.time === match.time);
            if (!alreadyExists) {
                newSessions.push({
                    id:        'sched-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
                    clientId,
                    date:      dateStr,
                    time:      match.time,
                    type:      match.type,
                    duration:  60,
                    notes:     '[Otomatik — haftalık program]',
                    status:    'scheduled',
                    createdAt: new Date().toISOString()
                });
            }
        }
        cur.setDate(cur.getDate() + 1);
    }

    if (!newSessions.length) {
        showNotification('Bu tarih aralığında eklenecek yeni seans yok', 'warning');
        return;
    }

    // Hepsini Firestore'a yaz
    await fbUpdateClient(currentUser.uid, clientId, { weeklySchedule: buildScheduleData() });
    for (const s of newSessions) {
        await upsertSession(currentUser.uid, s.id, s);
    }

    // Aktif paketin seans sayısını güncelle
    const pkg = packages.find(p => p.clientId === clientId && p.status === 'active');
    if (pkg && typeof pkg.remainingSessions === 'number') {
        const newRem = Math.max(0, pkg.remainingSessions - newSessions.length);
        await fbUpdatePackage(currentUser.uid, pkg.id, {
            remainingSessions: newRem,
            status: newRem === 0 ? 'completed' : pkg.status
        });
    }

    await loadDataFromFirestore(currentUser.uid);
    syncGlobalDataRefs();
    renderClients();
    renderCalendar();
    updateStats();
    document.getElementById('scheduleModal')?.remove();
    showNotification(`${newSessions.length} seans oluşturuldu ✓`, 'success');
}

window.openScheduleModal            = openScheduleModal;
window.toggleSchedRow               = toggleSchedRow;
window.saveSchedule                 = saveSchedule;
window.generateSessionsFromSchedule = generateSessionsFromSchedule;

// ============================================================
// ÇAKIŞMA KONTROLÜ — Seans formu anlık uyarı
// ============================================================
function checkSessionConflict() {
    const clientId = document.getElementById('sessionClient')?.value;
    const date     = document.getElementById('sessionDate')?.value;
    const time     = document.getElementById('sessionTime')?.value;
    const warnEl   = document.getElementById('sessionConflictWarn');
    const pkgEl    = document.getElementById('sessionPkgWarn');

    if (warnEl) warnEl.style.display = 'none';
    if (pkgEl)  pkgEl.style.display  = 'none';
    if (!clientId || !date) return;

    // Çakışma
    const conflict = sessions.find(s =>
        s.clientId === clientId && s.date === date && s.time === time && s.status !== 'absent'
    );
    if (conflict && warnEl) {
        warnEl.textContent = `⚠️ Bu danışanın ${date} tarihinde ${time}'da zaten bir seansı var.`;
        warnEl.style.display = 'block';
    }

    // Paket durumu
    const pkg = packages.find(p => p.clientId === clientId && p.status === 'active');
    if (pkg && pkgEl) {
        const rem = pkg.remainingSessions;
        if (rem === 0) {
            pkgEl.innerHTML = `📦 <strong>${pkg.name}</strong> paketi doldu! Yeni paket eklemeyi unutmayın.`;
            pkgEl.style.background = 'rgba(217,128,137,.12)';
            pkgEl.style.borderLeftColor = 'var(--danger)';
            pkgEl.style.color = 'var(--blush-dark)';
            pkgEl.style.display = 'block';
        } else if (rem <= 2) {
            pkgEl.innerHTML = `📦 <strong>${pkg.name}</strong> paketinde yalnızca <strong>${rem} seans</strong> kaldı.`;
            pkgEl.style.display = 'block';
        }
    } else if (!pkg && pkgEl && clientId) {
        const client = clients.find(c => c.id === clientId);
        const hasPkg = packages.some(p => p.clientId === clientId);
        if (!hasPkg && client) {
            pkgEl.innerHTML = `📦 <strong>${client.name}</strong> için henüz paket eklenmemiş.`;
            pkgEl.style.background = 'rgba(232,196,124,.12)';
            pkgEl.style.borderLeftColor = 'var(--warning)';
            pkgEl.style.color = '#7a5c10';
            pkgEl.style.display = 'block';
        }
    }
}
window.checkSessionConflict = checkSessionConflict;

// ============================================================
// PAKET BİTİYOR TOAST UYARISI
// ============================================================
function showPackageWarningToast(client, pkg, remaining) {
    if (!client) return;
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        background:var(--surface); border-radius:var(--r-lg); box-shadow:var(--shadow-xl);
        padding:16px 22px; z-index:9999; min-width:300px; max-width:400px;
        border:1.5px solid ${remaining === 0 ? 'var(--danger)' : 'var(--warning)'};
        display:flex; align-items:flex-start; gap:12px;
        animation:fadeUp .4s ease both;`;

    const icon    = remaining === 0 ? '🔴' : '🟡';
    const title   = remaining === 0 ? 'Paket Bitti!' : `Son ${remaining} Seans`;
    const message = remaining === 0
        ? `${client.name} için <strong>${pkg.name}</strong> paketi doldu. Yeni paket ekleyin.`
        : `${client.name} için <strong>${pkg.name}</strong> paketinde ${remaining} seans kaldı.`;

    toast.innerHTML = `
        <div style="font-size:26px; flex-shrink:0;">${icon}</div>
        <div style="flex:1;">
            <div style="font-weight:700; font-size:14px; color:var(--ink); margin-bottom:4px;">${title}</div>
            <div style="font-size:13px; color:var(--stone);">${message}</div>
            ${remaining === 0 ? `
            <button onclick="openAddPackageModal('${client.id}'); this.closest('[style]').remove()"
                class="btn btn-primary btn-sm" style="margin-top:10px;">
                📦 Yeni Paket Ekle
            </button>` : ''}
        </div>
        <button onclick="this.closest('[style]').remove()"
            style="background:none; border:none; font-size:18px; color:var(--stone); cursor:pointer; padding:0; flex-shrink:0;">✕</button>`;

    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) { toast.style.opacity='0'; toast.style.transition='opacity .3s'; setTimeout(()=>toast.remove(),300); }}, 8000);
}
window.showPackageWarningToast = showPackageWarningToast;

// ============================================================
// switchTab — priceList eklendi
// ============================================================
// Mevcut switchTab'ı genişlet
window.switchTab = function(tab) {
    // Tüm tabları ve sayfaları kapat
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Aktif tab butonunu bul (onclick="switchTab('x')" içeren)
    document.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('onclick') && t.getAttribute('onclick').includes("'" + tab + "'")) {
            t.classList.add('active');
        }
    });

    const pageMap = {
        clients:   { page: 'clientsPage',   render: renderClients },
        calendar:  { page: 'calendarPage',  render: renderCalendar },
        packages:  { page: 'packagesPage',  render: renderPackages },
        finance:   { page: 'financePage',   render: renderFinance },
        pricelist: { page: 'pricelistPage', render: renderPriceList },
        reports:   { page: 'reportsPage',   render: renderInstructorReports },
    };

    const entry = pageMap[tab];
    if (entry) {
        const pageEl = document.getElementById(entry.page);
        if (pageEl) pageEl.classList.add('active');
        if (entry.render) entry.render();
    }
};

// ============================================================
// FİYAT LİSTESİ & PAKET ŞABLONLARI
// ============================================================
let priceTemplates = [];

async function loadPriceTemplates() {
    // Firestore ÖNCELİKLİ — giriş yapılmışsa oradan al
    if (currentUser && typeof getProfile === 'function') {
        try {
            const profile = await getProfile(currentUser.uid);
            if (profile?.priceTemplates?.length) {
                priceTemplates = profile.priceTemplates;
                // localStorage'ı da güncelle
                try { localStorage.setItem('priceTemplates_' + currentUser.uid, JSON.stringify(priceTemplates)); } catch(e) {}
                console.log('Fiyat listesi Firestore yüklendi:', priceTemplates.length, 'sablon');
                return;
            }
        } catch(e) { console.warn('Fiyat listesi Firestore hatası:', e); }
    }
    // Firestore'dan gelemediyse localStorage'dan al
    try {
        const uid = currentUser?.uid || 'guest';
        const stored = localStorage.getItem('priceTemplates_' + uid);
        if (stored) {
            priceTemplates = JSON.parse(stored);
            console.log('Fiyat listesi localStorage yüklendi:', priceTemplates.length);
        }
    } catch(e) { priceTemplates = []; }
}

async function savePriceTemplates() {
    const uid = currentUser?.uid || 'guest';
    // Önce localStorage'a kaydet (hızlı)
    try { localStorage.setItem('priceTemplates_' + uid, JSON.stringify(priceTemplates)); } catch(e) {}
    // Sonra Firestore'a kaydet (kalıcı)
    if (currentUser && typeof saveProfile === 'function') {
        try {
            await saveProfile(currentUser.uid, { priceTemplates });
            console.log('Fiyat listesi Firestore kaydedildi');
        } catch(e) {
            console.error('❌ Fiyat listesi Firestore kayıt hatası:', e);
            if (typeof showNotification === 'function') {
                showNotification('Fiyat listesi kaydedilemedi: ' + (e.message || e), 'error');
            }
        }
    }
}

function renderPriceList() {
    const container = document.getElementById('priceListContainer');
    if (!container) return;

    if (!priceTemplates.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏷️</div>
                <p>Henüz fiyat eklenmemiş</p>
                <span>Sık kullandığınız paket şablonlarını buraya ekleyin</span>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px;">
            ${priceTemplates.map((t, i) => `
            <div style="background:var(--surface); border-radius:var(--r-lg); padding:20px 22px;
                 border:1px solid var(--border-soft); box-shadow:var(--shadow-sm);
                 transition:all var(--mid); position:relative;"
                 onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
                 onmouseout="this.style.transform='';this.style.boxShadow='var(--shadow-sm)'">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                        <div style="font-family:'Playfair Display',serif; font-size:1rem; font-weight:600; color:var(--ink);">${t.name}</div>
                        <div style="font-size:12px; color:var(--stone); margin-top:2px;">${t.type || ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.3rem; font-weight:700; color:var(--sage-dark); font-family:'Playfair Display',serif;">${t.price.toLocaleString('tr-TR')} ${t.currency || '₺'}</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
                    <span style="padding:3px 10px; background:var(--sage-light); color:var(--sage-dark); border-radius:99px; font-size:12px; font-weight:600;">
                        ${t.sessions} Seans
                    </span>
                    <span style="padding:3px 10px; background:var(--lav-light); color:var(--lav-dark); border-radius:99px; font-size:12px; font-weight:600;">
                        ${(t.price / t.sessions).toFixed(0)} ₺/seans
                    </span>
                    ${t.duration ? `<span style="padding:3px 10px; background:var(--surface-2); color:var(--stone); border-radius:99px; font-size:12px;">${t.duration} dk</span>` : ''}
                </div>
                ${t.instructorId ? (() => {
                    const ins = instructors.find(i => i.id === t.instructorId);
                    return ins ? `<div style="display:flex; align-items:center; gap:6px; margin-bottom:14px; padding:6px 10px;
                         background:rgba(184,169,212,.1); border-radius:var(--r-sm); border-left:3px solid var(--lav-light);">
                        <span style="font-size:14px;">👩‍🏫</span>
                        <span style="font-size:12px; font-weight:600; color:var(--lav-dark);">${ins.name}</span>
                        <span style="font-size:11px; color:var(--stone);">· %${ins.commission} komisyon</span>
                    </div>` : '';
                })() : ''}
                ${t.notes ? `<div style="font-size:12px; color:var(--stone); margin-bottom:12px;">${t.notes}</div>` : ''}
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-primary btn-sm" style="flex:1;"
                        onclick="useTemplate(${i})">
                        ＋ Pakete Uygula
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="editPriceTemplate(${i})" style="padding:7px 10px;">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="deletePriceTemplate(${i})" style="padding:7px 10px; color:var(--danger);">🗑</button>
                </div>
            </div>`).join('')}
        </div>`;
}

function openAddPriceModal(editIndex = null) {
    const t = editIndex !== null ? priceTemplates[editIndex] : null;
    const existing = document.getElementById('priceModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'priceModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px;">
            <div class="modal-header">
                <h3>${t ? '✏️ Fiyat Düzenle' : '🏷️ Yeni Fiyat Ekle'}</h3>
                <button class="close-btn" onclick="document.getElementById('priceModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Paket Adı *</label>
                    <input type="text" id="pt_name" value="${t?.name||''}" placeholder="Örn: 8 Seans Pilates">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Seans Sayısı *</label>
                        <input type="number" id="pt_sessions" value="${t?.sessions||8}" min="1">
                    </div>
                    <div class="form-group">
                        <label>Fiyat *</label>
                        <div style="display:flex; gap:6px;">
                            <select id="pt_currency" style="width:80px; padding:7px 6px; border:1.5px solid var(--border); border-radius:var(--r-sm); font-size:13px;">
                                <option value="TRY" ${t?.currency==='TRY'||!t?.currency?'selected':''}>₺</option>
                                <option value="USD" ${t?.currency==='USD'?'selected':''}>$</option>
                                <option value="EUR" ${t?.currency==='EUR'?'selected':''}>€</option>
                                <option value="GBP" ${t?.currency==='GBP'?'selected':''}>£</option>
                            </select>
                            <input type="number" id="pt_price" value="${t?.price||''}" placeholder="0" style="flex:1;">
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Seans Türü</label>
                        <select id="pt_type">
                            <option value="">— Seçiniz —</option>
                            ${sessionTypes.map(opt =>
                                `<option value="${opt}" ${t?.type===opt?'selected':''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Süre (dk)</label>
                        <input type="number" id="pt_duration" value="${t?.duration||60}" min="15" step="15">
                    </div>
                </div>
                <div class="form-group">
                    <label>👩‍🏫 Eğitmen</label>
                    <select id="pt_instructor">
                        <option value="">— Eğitmen Yok —</option>
                        ${instructors.map(ins =>
                            `<option value="${ins.id}" ${t?.instructorId===ins.id?'selected':''}>${ins.name} (%${ins.commission})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Notlar</label>
                    <input type="text" id="pt_notes" value="${t?.notes||''}" placeholder="Örn: Bireysel, sabah saatleri">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('priceModal').remove()">İptal</button>
                <button class="btn btn-primary" onclick="savePriceTemplate(${editIndex})">💾 Kaydet</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

async function savePriceTemplate(editIndex) {
    const name     = document.getElementById('pt_name')?.value.trim();
    const sessions = parseInt(document.getElementById('pt_sessions')?.value);
    const price    = parseFloat(document.getElementById('pt_price')?.value);
    const type     = document.getElementById('pt_type')?.value;
    const duration = parseInt(document.getElementById('pt_duration')?.value) || 60;
    const notes    = document.getElementById('pt_notes')?.value.trim();
    const currency     = document.getElementById('pt_currency')?.value || 'TRY';
    const instructorId = document.getElementById('pt_instructor')?.value || null;

    if (!name || !sessions || !price) { showNotification('Ad, seans ve fiyat zorunlu', 'error'); return; }

    const template = { name, sessions, price, currency, type, duration, notes, instructorId, updatedAt: new Date().toISOString() };

    if (editIndex !== null) {
        priceTemplates[editIndex] = template;
    } else {
        priceTemplates.push(template);
    }

    await savePriceTemplates();
    renderPriceList();
    document.getElementById('priceModal')?.remove();
    showNotification('Fiyat kaydedildi ✓', 'success');
}

function editPriceTemplate(i) { openAddPriceModal(i); }

async function deletePriceTemplate(i) {
    if (!confirm('Bu fiyat şablonunu silmek istiyor musunuz?')) return;
    priceTemplates.splice(i, 1);
    await savePriceTemplates();
    renderPriceList();
    showNotification('Silindi', 'success');
}

function useTemplate(i) {
    const t = priceTemplates[i];
    if (!t) return;
    openAddPackageModal();
    setTimeout(() => {
        const nameEl     = document.getElementById('packageName');
        const sessionsEl = document.getElementById('packageSessions');
        const priceEl    = document.getElementById('packagePrice');
        if (nameEl)     nameEl.value     = t.name;
        if (sessionsEl) sessionsEl.value = t.sessions;
        if (priceEl)    priceEl.value    = t.price;
    }, 100);
}

window.openAddPriceModal  = openAddPriceModal;
window.savePriceTemplate  = savePriceTemplate;
window.editPriceTemplate  = editPriceTemplate;
window.deletePriceTemplate= deletePriceTemplate;
window.useTemplate        = useTemplate;
window.renderPriceList    = renderPriceList;
window.loadPriceTemplates = loadPriceTemplates;

// ============================================================
// YEDEKLEme / GERİ YÜKLEME
// ============================================================
function exportBackup() {
    const data = {
        version:   '1.0',
        exportDate: new Date().toISOString(),
        exportedBy: currentUser?.email || 'guest',
        clients,
        sessions,
        packages,
        payments,
        priceTemplates,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `stulio-yedek-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Yedek dosyası indirildi ✓', 'success');
}

async function importBackup(input) {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Versiyon kontrolü
            if (!data.clients || !data.sessions) {
                showNotification('Geçersiz yedek dosyası', 'error');
                return;
            }

            const count = data.clients.length + data.sessions.length + data.packages.length + data.payments.length;
            const ok = confirm(
                `📥 Yedek Yükleme\n\n` +
                `Dosya: ${file.name}\n` +
                `Tarih: ${data.exportDate ? new Date(data.exportDate).toLocaleDateString('tr-TR') : 'Bilinmiyor'}\n` +
                `İçerik: ${data.clients.length} danışan, ${data.sessions.length} seans, ${data.packages.length} paket, ${data.payments.length} ödeme\n\n` +
                `⚠️ Mevcut veriler üzerine yazılacak. Devam etmek istiyor musunuz?`
            );
            if (!ok) return;

            if (!currentUser) { showNotification('Yedek yüklemek için giriş yapın', 'error'); return; }

            showNotification('Yükleniyor... lütfen bekleyin', 'success');

            // Firestore'a yaz
            for (const c of data.clients)  await upsertClient (currentUser.uid, c.id, c);
            for (const s of data.sessions) await upsertSession(currentUser.uid, s.id, s);
            for (const p of data.packages) await upsertPackage(currentUser.uid, p.id, p);
            for (const p of data.payments) await upsertPayment(currentUser.uid, p.id, p);

            if (data.priceTemplates) {
                priceTemplates = data.priceTemplates;
                await savePriceTemplates();
            }

            await loadDataFromFirestore(currentUser.uid);
            syncGlobalDataRefs();
            renderClients();
            updateStats();
            updateNotifBadge();

            showNotification(`✓ ${count} kayıt başarıyla yüklendi`, 'success');
        } catch(err) {
            console.error(err);
            showNotification('Yükleme hatası: ' + err.message, 'error');
        }
        input.value = ''; // reset file input
    };
    reader.readAsText(file);
}

window.exportBackup = exportBackup;
window.importBackup = importBackup;

// Uygulama başlarken fiyat şablonlarını yükle
// loadPriceTemplates auth sonrası çağrılıyor (yukarıda init bloğunda)

// ============================================================
// ÖZELLEŞTIRILEBILIR SEANS TÜRLERİ
// ============================================================

// Varsayılan seans türleri — sektöre göre hazır paketler
const SESSION_TYPE_PRESETS = {
    saglik: {
        label: '🏥 Sağlık & Terapi',
        types: ['Fizyoterapi', 'Reformer Pilates', 'Yoga', 'Mat Pilates', 'Masaj', 'Osteopati', 'Kinesyo Bant']
    },
    guzellik: {
        label: '💅 Güzellik & Bakım',
        types: ['Manikür', 'Pedikür', 'Protez Tırnak', 'Kalıcı Oje', 'Nail Art', 'El Bakımı', 'Ayak Bakımı']
    },
    sac: {
        label: '💇 Saç & Kuaför',
        types: ['Saç Kesimi', 'Boyama', 'Röfle', 'Keratin', 'Perma', 'Fön', 'Maske']
    },
    spa: {
        label: '🧖 Spa & Masaj',
        types: ['Klasik Masaj', 'Aromaterapi', 'Derin Doku', 'Taş Masajı', 'Cilt Bakımı', 'Epilasyon']
    },
    fitness: {
        label: '💪 Fitness & Spor',
        types: ['Personal Training', 'Crossfit', 'Pilates', 'Yoga', 'Boks', 'Yüzme', 'Beslenme Danışmanlığı']
    },
    egitim: {
        label: '📚 Eğitim & Danışmanlık',
        types: ['Birebir Ders', 'Grup Dersi', 'Online Ders', 'Danışmanlık', 'Koçluk']
    }
};

// Global seans türleri listesi
let sessionTypes = [];

// Yükle (Firestore'dan veya localStorage'dan)
async function loadSessionTypes() {
    try {
        const stored = localStorage.getItem('sessionTypes_' + (currentUser?.uid || 'guest'));
        if (stored) {
            sessionTypes = JSON.parse(stored);
            updateAllSessionTypeSelects();
            return;
        }
    } catch(e) {}

    // Firestore'dan dene
    if (currentUser) {
        try {
            const profile = await getProfile(currentUser.uid);
            if (profile?.sessionTypes?.length) {
                sessionTypes = profile.sessionTypes;
                saveSessionTypesLocal();
                updateAllSessionTypeSelects();
                return;
            }
        } catch(e) {}
    }

    // Varsayılan türler yok — kullanıcı kendi eklesin
    sessionTypes = [];
    updateAllSessionTypeSelects();
}

function saveSessionTypesLocal() {
    try {
        localStorage.setItem('sessionTypes_' + (currentUser?.uid || 'guest'), JSON.stringify(sessionTypes));
    } catch(e) {}
}

async function saveSessionTypesToFirestore() {
    if (!currentUser) return;
    try {
        await saveProfile(currentUser.uid, { sessionTypes });
    } catch(e) { console.warn('sessionTypes Firestore kaydı:', e); }
}

// Tüm seans türü select'lerini güncelle
function updateAllSessionTypeSelects() {
    const selectIds = ['sessionType', 'filterSessionType', 'absType'];
    selectIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        if (id === 'filterSessionType') {
            el.innerHTML = '<option value="all">Tüm Seans Türleri</option>' +
                sessionTypes.map(t => `<option value="${t}">${t}</option>`).join('');
        } else {
            el.innerHTML = sessionTypes.map(t =>
                `<option value="${t}" ${t === current ? 'selected' : ''}>${t}</option>`
            ).join('');
        }
    });

    // Haftalık program schedule type selects
    for (let i = 0; i < 7; i++) {
        const el = document.getElementById('schedType_' + i);
        if (!el) continue;
        const current = el.value;
        el.innerHTML = sessionTypes.map(t =>
            `<option value="${t}" ${t === current ? 'selected' : ''}>${t}</option>`
        ).join('');
    }

    // Fiyat listesi modal
    const ptType = document.getElementById('pt_type');
    if (ptType) {
        const current = ptType.value;
        ptType.innerHTML = sessionTypes.map(t =>
            `<option value="${t}" ${t === current ? 'selected' : ''}>${t}</option>`
        ).join('');
    }
}

// ─── SEANS TÜRLERİ YÖNETİM MODAL ───────────────────────────
function openSessionTypesModal() {
    const existing = document.getElementById('sessionTypesModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'sessionTypesModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;">
            <div class="modal-header">
                <h3>🏷️ Seans Türleri</h3>
                <button class="close-btn" onclick="document.getElementById('sessionTypesModal').remove()">✕</button>
            </div>
            <div class="modal-body">

                <!-- Hazır paketler -->
                <div class="form-group">
                    <label>Hazır Paket Seç</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:4px;">
                        ${Object.entries(SESSION_TYPE_PRESETS).map(([key, preset]) => `
                        <button type="button" class="btn btn-secondary btn-sm"
                            style="justify-content:flex-start; text-align:left;"
                            onclick="loadPreset('${key}')">
                            ${preset.label}
                        </button>`).join('')}
                    </div>
                    <div class="form-hint">Seçince mevcut türlere ekler, sizmekini silersiniz.</div>
                </div>

                <div class="divider"></div>

                <!-- Mevcut türler -->
                <div class="form-group">
                    <label>Mevcut Seans Türleri</label>
                    <div id="sessionTypesList" style="display:flex; flex-direction:column; gap:6px;"></div>
                </div>

                <!-- Yeni ekle -->
                <div class="form-group" style="margin-bottom:0;">
                    <label>Yeni Tür Ekle</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="newSessionType" placeholder="Örn: Epilasyon, Cilt Bakımı..."
                            style="flex:1;" onkeydown="if(event.key==='Enter') addSessionType()">
                        <button class="btn btn-primary btn-sm" onclick="addSessionType()">＋ Ekle</button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('sessionTypesModal').remove()">İptal</button>
                <button class="btn btn-primary" onclick="saveSessionTypes()">💾 Kaydet</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    renderSessionTypesList();
}

function renderSessionTypesList() {
    const el = document.getElementById('sessionTypesList');
    if (!el) return;
    if (!sessionTypes.length) {
        el.innerHTML = '<div style="color:var(--stone); font-size:13px; padding:8px;">Henüz tür eklenmemiş</div>';
        return;
    }
    el.innerHTML = sessionTypes.map((t, i) => `
        <div style="display:flex; align-items:center; gap:8px; padding:9px 12px;
             background:var(--surface-2); border-radius:var(--r-sm); border:1px solid var(--border-soft);">
            <span style="flex:1; font-size:13px; font-weight:500;">${t}</span>
            <button onclick="removeSessionType(${i})"
                style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px; padding:0 4px;">✕</button>
        </div>`).join('');
}

function addSessionType() {
    const input = document.getElementById('newSessionType');
    const val = input?.value.trim();
    if (!val) return;
    if (sessionTypes.includes(val)) {
        showNotification('Bu tür zaten var', 'warning');
        return;
    }
    sessionTypes.push(val);
    if (input) input.value = '';
    renderSessionTypesList();
    showNotification(val + ' eklendi', 'success');
}

function removeSessionType(i) {
    sessionTypes.splice(i, 1);
    renderSessionTypesList();
}

function loadPreset(key) {
    const preset = SESSION_TYPE_PRESETS[key];
    if (!preset) return;
    preset.types.forEach(t => {
        if (!sessionTypes.includes(t)) sessionTypes.push(t);
    });
    renderSessionTypesList();
    showNotification(preset.label + ' türleri eklendi', 'success');
}

async function saveSessionTypes() {
    saveSessionTypesLocal();
    await saveSessionTypesToFirestore();
    updateAllSessionTypeSelects();
    document.getElementById('sessionTypesModal')?.remove();
    showNotification('Seans türleri kaydedildi ✓', 'success');
}

window.openSessionTypesModal = openSessionTypesModal;
window.addSessionType        = addSessionType;
window.removeSessionType     = removeSessionType;
window.loadPreset            = loadPreset;
window.saveSessionTypes      = saveSessionTypes;
window.loadSessionTypes      = loadSessionTypes;
window.updateAllSessionTypeSelects = updateAllSessionTypeSelects;

// ============================================================
// SEANS DÜZENLEME
// ============================================================
function openEditSessionModal(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    document.getElementById('editSessionId').value = sessionId;
    document.getElementById('editSessionDate').value = session.date || '';
    document.getElementById('editSessionTime').value = session.time || '';
    document.getElementById('editSessionDuration').value = session.duration || 60;
    document.getElementById('editSessionNotes').value = session.notes || '';
    document.getElementById('editSessionStatus').value = session.status || 'normal';

    // Client select
    const clientSel = document.getElementById('editSessionClient');
    clientSel.innerHTML = clients.map(c =>
        `<option value="${c.id}" ${c.id === session.clientId ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    // Type select
    const typeSel = document.getElementById('editSessionType');
    typeSel.innerHTML = sessionTypes.map(t =>
        `<option value="${t}" ${t === session.type ? 'selected' : ''}>${t}</option>`
    ).join('');

    document.getElementById('editSessionModal').classList.add('active');
}

async function saveEditedSession() {
    if (!currentUser) return;
    const id       = document.getElementById('editSessionId').value;
    const clientId = document.getElementById('editSessionClient').value;
    const date     = document.getElementById('editSessionDate').value;
    const time     = document.getElementById('editSessionTime').value;
    const type     = document.getElementById('editSessionType').value;
    const duration = parseInt(document.getElementById('editSessionDuration').value) || 60;
    const notes    = document.getElementById('editSessionNotes').value.trim();
    const status   = document.getElementById('editSessionStatus').value;

    if (!date || !time) { showNotification('Tarih ve saat zorunlu', 'error'); return; }

    await upsertSession(currentUser.uid, id, { id, clientId, date, time, type, duration, notes, status });
    await loadDataFromFirestore(currentUser.uid);
    syncGlobalDataRefs();
    renderClients();
    renderCalendar();
    document.getElementById('editSessionModal').classList.remove('active');
    showNotification('Seans güncellendi ✓', 'success');
}

async function deleteSessionFromEdit() {
    const id = document.getElementById('editSessionId').value;
    if (!confirm('Bu seansı silmek istiyor musunuz?')) return;
    await deleteSession(id);
    document.getElementById('editSessionModal').classList.remove('active');
    showNotification('Seans silindi', 'success');
}

window.openEditSessionModal = openEditSessionModal;
window.saveEditedSession    = saveEditedSession;
window.deleteSessionFromEdit = deleteSessionFromEdit;

// ============================================================
// GİDER TAKİBİ
// ============================================================
let expenses = [];

async function loadExpenses() {
    try {
        const stored = localStorage.getItem('expenses_' + (currentUser?.uid || 'guest'));
        if (stored) expenses = JSON.parse(stored);
    } catch(e) { expenses = []; }
    if (currentUser) {
        try {
            const profile = await getProfile(currentUser.uid);
            if (profile?.expenses) expenses = profile.expenses;
        } catch(e) {}
    }
}

async function saveExpenses() {
    try { localStorage.setItem('expenses_' + (currentUser?.uid || 'guest'), JSON.stringify(expenses)); } catch(e) {}
    if (currentUser) {
        try { await saveProfile(currentUser.uid, { expenses }); } catch(e) {}
    }
}

function openExpenseModal() {
    const d = new Date().toISOString().slice(0,10);
    document.getElementById('expenseDate').value = d;
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    renderExpenseList();
    document.getElementById('expenseModal').classList.add('active');
}

function renderExpenseList() {
    const el = document.getElementById('expenseList');
    if (!el) return;
    if (!expenses.length) {
        el.innerHTML = '<div style="text-align:center; color:var(--stone); font-size:13px; padding:16px;">Gider kaydı yok</div>';
        return;
    }
    const sorted = [...expenses].sort((a,b) => new Date(b.date) - new Date(a.date));
    el.innerHTML = `
        <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--stone); margin-bottom:8px;">
            Toplam: ${expenses.reduce((s,e) => s + e.amount, 0).toFixed(0)} ₺
        </div>
        ${sorted.map((exp, i) => `
        <div style="display:flex; align-items:center; gap:10px; padding:9px 12px;
             background:var(--surface-2); border-radius:var(--r-sm); margin-bottom:6px;">
            <div style="flex:1;">
                <div style="font-size:13px; font-weight:600;">${exp.desc}</div>
                <div style="font-size:11px; color:var(--stone);">${exp.category} · ${new Date(exp.date).toLocaleDateString('tr-TR')}</div>
            </div>
            <strong style="color:var(--danger);">-${exp.amount.toFixed(0)} ₺</strong>
            <button onclick="removeExpense(${i})" style="background:none; border:none; color:var(--stone); cursor:pointer; font-size:14px;">✕</button>
        </div>`).join('')}`;
}

async function saveExpense() {
    const desc   = document.getElementById('expenseDesc')?.value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount')?.value);
    const date   = document.getElementById('expenseDate')?.value;
    const cat    = document.getElementById('expenseCategory')?.value;
    if (!desc || !amount || !date) { showNotification('Açıklama, tutar ve tarih zorunlu', 'error'); return; }
    expenses.push({ desc, amount, date, category: cat, id: 'exp-' + Date.now() });
    await saveExpenses();
    renderExpenseList();
    updateFinanceKPIs();
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
    showNotification('Gider eklendi ✓', 'success');
}

async function removeExpense(i) {
    expenses.splice(i, 1);
    await saveExpenses();
    renderExpenseList();
    updateFinanceKPIs();
}

function updateFinanceKPIs() {
    const totalExp = expenses.reduce((s,e) => s + e.amount, 0);
    const expEl = document.getElementById('totalExpense');
    if (expEl) expEl.textContent = totalExp.toFixed(0) + ' ₺';

    // Kazanılacak gelir = aktif paketlerin toplam fiyatı
    const expected = packages.reduce((s,p) => s + (p.price || 0), 0);
    const expInc = document.getElementById('expectedIncome');
    if (expInc) expInc.textContent = expected.toFixed(0) + ' ₺';
    const expDesc = document.getElementById('expectedDesc');
    if (expDesc) expDesc.textContent = packages.length + ' paket toplam';
}

window.openExpenseModal  = openExpenseModal;
window.saveExpense       = saveExpense;
window.removeExpense     = removeExpense;
window.loadExpenses      = loadExpenses;
window.updateFinanceKPIs = updateFinanceKPIs;

// ============================================================
// DANIŞAN DETAY & DÜZENLEME (TAM)
// ============================================================
function openEditClientModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const clientSessions = sessions
        .filter(s => s.clientId === clientId)
        .sort((a,b) => new Date(b.date) - new Date(a.date));
    const clientPackages = packages.filter(p => p.clientId === clientId);
    const clientPayments = payments.filter(p => p.clientId === clientId);

    document.getElementById('editClientTitle').innerHTML = `✏️ ${client.name}`;

    document.getElementById('editClientBody').innerHTML = `
        <!-- Tab menü -->
        <div style="display:flex; gap:0; border-bottom:1px solid var(--border-soft); margin-bottom:20px;">
            ${[['bilgi','👤 Bilgiler'],['paketler','📦 Paketler'],['seanslar','📅 Seanslar'],['odemeler','💳 Ödemeler']]
                .map(([id,label],i) => `
                <button onclick="switchDetailTab('${id}')"
                    id="dtab_${id}"
                    style="padding:11px 18px; border:none; background:none; cursor:pointer; font-family:DM Sans,sans-serif;
                           font-size:13px; font-weight:600; border-bottom:2.5px solid ${i===0?'var(--sage-dark)':'transparent'};
                           color:${i===0?'var(--sage-dark)':'var(--stone)'}; transition:all .2s;">
                    ${label}
                </button>`).join('')}
        </div>

        <!-- BİLGİLER -->
        <div id="dtab_bilgi_content">
            <div class="form-row">
                <div class="form-group">
                    <label>Ad Soyad *</label>
                    <input type="text" id="ec_name" value="${client.name || ''}">
                </div>
                <div class="form-group">
                    <label>Telefon *</label>
                    <input type="tel" id="ec_phone" value="${client.phone || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>E-posta</label>
                    <input type="email" id="ec_email" value="${client.email || ''}">
                </div>
                <div class="form-group">
                    <label>Doğum Tarihi</label>
                    <input type="date" id="ec_birthdate" value="${client.birthdate || ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Şikayetler / Tanı</label>
                <textarea id="ec_complaints" rows="2">${client.complaints || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Notlar</label>
                <textarea id="ec_notes" rows="2">${client.notes || ''}</textarea>
            </div>
            <div style="display:flex; gap:10px; margin-top:4px;">
                <button class="btn btn-primary" onclick="saveEditedClient('${clientId}')">💾 Kaydet</button>
                <button class="btn btn-danger btn-sm" onclick="deleteClient('${clientId}'); document.getElementById('editClientModal').classList.remove('active')">🗑 Sil</button>
            </div>
        </div>

        <!-- PAKETLER -->
        <div id="dtab_paketler_content" style="display:none;">
            <button class="btn btn-lavender btn-sm" style="margin-bottom:14px;"
                onclick="document.getElementById('editClientModal').classList.remove('active'); openAddPackageModal('${clientId}')">
                ＋ Yeni Paket
            </button>
            ${clientPackages.length ? clientPackages.map(p => {
                const used = (p.totalSessions||0) - (p.remainingSessions||0);
                const pct  = p.totalSessions ? Math.round(used/p.totalSessions*100) : 0;
                const debt = (p.price||0) - (p.paidAmount||0);
                return `
                <div class="package-card" style="margin-bottom:12px;">
                    <div class="package-header">
                        <div>
                            <strong>${p.name}</strong>
                            <span class="badge ${p.status==='active'?'badge-active':'badge-frozen'}" style="margin-left:8px;">
                                ${p.status==='active'?'Aktif':'Tamamlandı'}
                            </span>
                            ${p.instructorId ? (() => {
                                const ins = instructors.find(i => i.id === p.instructorId);
                                return ins ? `<span style="margin-left:8px; padding:2px 9px; background:rgba(184,169,212,.15); color:var(--lav-dark);
                                    border-radius:99px; font-size:11px; font-weight:600;">👩‍🏫 ${ins.name}</span>` : '';
                            })() : ''}
                        </div>
                        <div style="font-size:12px; color:var(--stone);">
                            ${p.startDate ? new Date(p.startDate).toLocaleDateString('tr-TR') : ''}
                        </div>
                    </div>
                    <div style="font-size:13px; color:var(--ink-soft); margin:6px 0;">
                        📊 ${used}/${p.totalSessions||0} seans &nbsp;|&nbsp;
                        💳 ${(p.paidAmount||0).toFixed(0)} / ${(p.price||0).toFixed(0)} ₺
                        ${debt > 0 ? `&nbsp;|&nbsp; <span style="color:var(--danger);">Kalan: ${debt.toFixed(0)} ₺</span>` : ''}
                    </div>
                    <div class="package-progress">
                        <div class="package-progress-bar" style="width:${pct}%"></div>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:10px;">
                        ${debt > 0 ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal('${p.id}')">💳 Ödeme Al</button>` : ''}
                        <button class="btn btn-lavender btn-sm" onclick="openInstallmentModal('${p.id}')">📅 Taksit</button>
                        <button class="btn btn-danger btn-sm" onclick="deletePackage('${p.id}')">🗑</button>
                    </div>
                </div>`;
            }).join('') : '<p class="text-muted" style="padding:16px;">Paket yok</p>'}
        </div>

        <!-- SEANSLAR -->
        <div id="dtab_seanslar_content" style="display:none;">
            <button class="btn btn-success btn-sm" style="margin-bottom:14px;"
                onclick="document.getElementById('editClientModal').classList.remove('active'); openAddSessionModal('${clientId}')">
                ＋ Seans Ekle
            </button>
            <div style="display:flex; flex-direction:column; gap:6px;">
            ${clientSessions.length ? clientSessions.map(s => {
                const statusLabel = {normal:'',absent:'🚫 Devamsız',telafi:'🔄 Telafi',scheduled:'📅 Programlı'}[s.status||'normal'];
                return `
                <div style="display:flex; align-items:center; gap:10px; padding:10px 14px;
                     background:var(--surface-2); border-radius:var(--r-sm); border:1px solid var(--border-soft);">
                    <div style="flex:1;">
                        <div style="font-size:13px; font-weight:600;">${s.date} ${s.time}</div>
                        <div style="font-size:12px; color:var(--stone);">${s.type} · ${s.duration}dk ${statusLabel}</div>
                        ${s.notes ? `<div style="font-size:11px; color:var(--stone); margin-top:2px;">${s.notes.substring(0,60)}</div>` : ''}
                    </div>
                    <button class="btn btn-secondary btn-xs" onclick="openEditSessionModal('${s.id}')">✏️ Düzenle</button>
                </div>`;
            }).join('') : '<p class="text-muted" style="padding:16px;">Seans kaydı yok</p>'}
            </div>
        </div>

        <!-- ÖDEMELER -->
        <div id="dtab_odemeler_content" style="display:none;">
            ${clientPayments.length ? `
            <table class="finance-table">
                <thead><tr><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th>Paket</th></tr></thead>
                <tbody>
                ${clientPayments.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(pay => {
                    const pkg = packages.find(p => p.id === pay.packageId);
                    return `<tr>
                        <td>${new Date(pay.date).toLocaleDateString('tr-TR')}</td>
                        <td><strong style="color:var(--sage-dark);">+${pay.amount.toFixed(2)} ${pay.currency ? pay.currency : '₺'}</strong></td>
                        <td>${pay.method||'—'}</td>
                        <td style="font-size:12px; color:var(--stone);">${pkg?pkg.name:'—'}</td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>` : '<p class="text-muted" style="padding:16px;">Ödeme kaydı yok</p>'}
        </div>`;

    document.getElementById('editClientModal').classList.add('active');
}

function switchDetailTab(tabId) {
    ['bilgi','paketler','seanslar','odemeler'].forEach(id => {
        const content = document.getElementById('dtab_' + id + '_content');
        const btn     = document.getElementById('dtab_' + id);
        if (content) content.style.display = id === tabId ? 'block' : 'none';
        if (btn) {
            btn.style.borderBottomColor = id === tabId ? 'var(--sage-dark)' : 'transparent';
            btn.style.color             = id === tabId ? 'var(--sage-dark)' : 'var(--stone)';
        }
    });
}

async function saveEditedClient(clientId) {
    if (!currentUser) return;
    const name      = document.getElementById('ec_name')?.value.trim();
    const phone     = document.getElementById('ec_phone')?.value.trim();
    const email     = document.getElementById('ec_email')?.value.trim();
    const birthdate = document.getElementById('ec_birthdate')?.value;
    const complaints= document.getElementById('ec_complaints')?.value.trim();
    const notes     = document.getElementById('ec_notes')?.value.trim();

    if (!name || !phone) { showNotification('Ad ve telefon zorunlu', 'error'); return; }

    await fbUpdateClient(currentUser.uid, clientId, { name, phone, email, birthdate, complaints, notes });
    await loadDataFromFirestore(currentUser.uid);
    syncGlobalDataRefs();
    renderClients();
    showNotification('Danışan güncellendi ✓', 'success');
    // Reload modal with fresh data
    openEditClientModal(clientId);
}

window.openEditClientModal  = openEditClientModal;
window.switchDetailTab      = switchDetailTab;
window.saveEditedClient     = saveEditedClient;

// ============================================================
// ACCORDION - toggleSection
// ============================================================
function toggleSection(sectionId, chevronId) {
    const section = document.getElementById(sectionId);
    const chevron = document.getElementById(chevronId);
    if (!section) return;
    const isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    if (chevron) {
        chevron.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

// Accordion'ları başlangıçta kapalı yap
function initAccordions() {
    // Finans - bekleyen ödemeler
    const debtSec = document.getElementById('debtSection');
    if (debtSec) {
        debtSec.style.display = 'none';
        const ch = document.getElementById('debtChevron');
        if (ch) ch.style.transform = 'rotate(-90deg)';
    }
    // Finans - ödemeler
    const paySec = document.getElementById('paymentSection');
    if (paySec) {
        paySec.style.display = 'none';
        const ch = document.getElementById('paymentChevron');
        if (ch) ch.style.transform = 'rotate(-90deg)';
    }
}
window.toggleSection  = toggleSection;
window.initAccordions = initAccordions;

window.clearFinanceFilters  = function() {
    ['financeSearch','financeFilterMethod','financeFilterMonth','financeFromDate','financeToDate'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'SELECT') el.value = 'all';
        else el.value = '';
    });
    renderPaymentHistory();
};


// ============================================================
// ÇOKLU PAKET SEÇİMİ - checkSessionConflict güncelle
// ============================================================
// Orijinal checkSessionConflict'i genişlet
const _origCheckConflict = window.checkSessionConflict;
window.checkSessionConflict = function() {
    if (typeof _origCheckConflict === 'function') _origCheckConflict();

    const clientId   = document.getElementById('sessionClient')?.value;
    const pkgSelWrap = document.getElementById('sessionPackageSelect');
    const pkgSel     = document.getElementById('sessionPackageId');
    if (!pkgSelWrap || !pkgSel || !clientId) return;

    // O danışanın aktif paketlerini bul
    const activePkgs = packages.filter(p => p.clientId === clientId && p.status === 'active');
    
    if (activePkgs.length > 1) {
        // Birden fazla aktif paket var — seçtir
        pkgSel.innerHTML = '<option value="">— Paket seçin —</option>' +
            activePkgs.map(p =>
                `<option value="${p.id}">${p.name} (${p.remainingSessions} seans kaldı)</option>`
            ).join('');
        pkgSelWrap.style.display = 'block';
    } else if (activePkgs.length === 1) {
        // Tek paket — otomatik seç, gösterme
        pkgSel.innerHTML = `<option value="${activePkgs[0].id}" selected>${activePkgs[0].name}</option>`;
        pkgSelWrap.style.display = 'none';
    } else {
        pkgSel.innerHTML = '<option value="">Aktif paket yok</option>';
        pkgSelWrap.style.display = 'none';
    }
};

// saveSession'da seçilen paketi kullan
const _origSaveSession = window.saveSession;
// saveSession zaten app.js'te tanımlı, packageId'yi sessionPackageId'den alacak şekilde güncelle
// Mevcut saveSession'ı wrap et
window.saveSession = async function() {
    // packageId seçilmişse kullan
    const selectedPkgId = document.getElementById('sessionPackageId')?.value;
    if (selectedPkgId) {
        window._overridePackageId = selectedPkgId;
    } else {
        window._overridePackageId = null;
    }
    await _origSaveSession();
};

// ============================================================
// FİYAT LİSTESİ - Paket eklerken fiyat listesinden seç
// ============================================================
async function buildPackageFromPriceList() {
    // Önce Firestore'dan yükle (güncel listeyi al)
    await loadPriceTemplates();

    if (!priceTemplates.length) {
        showNotification('Önce 🏷️ Fiyat Listesi sekmesinden şablon ekleyin', 'warning');
        return;
    }

    const existing = document.getElementById('priceListPickerModal');
    if (existing) existing.remove();

    // Kartları oluştur
    const cardsHTML = priceTemplates.map((t, i) => {
        const sym = t.currency === 'USD' ? '$' : t.currency === 'EUR' ? '€' : t.currency === 'GBP' ? '£' : '₺';
        const perSession = t.sessions > 0 ? (t.price / t.sessions).toFixed(0) : '0';
        var hoverIn  = "this.style.outline='2px solid var(--sage-dark)'";
        var hoverOut = "this.style.outline=''";
        return '<div onclick="applyPriceTemplate(' + i + ')"' +
            ' style="padding:14px 16px; background:var(--surface-2); border-radius:var(--r-md);' +
            ' border:1.5px solid var(--border); cursor:pointer; transition:all .15s; margin-bottom:8px;"' +
            ' onmouseover="' + hoverIn + '"' +
            ' onmouseout="' + hoverOut + '">' +
            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                '<div style="flex:1; min-width:0;">' +
                    '<div style="font-weight:600; font-size:14px; color:var(--ink);">' + t.name + '</div>' +
                    '<div style="font-size:12px; color:var(--stone); margin-top:3px;">' +
                        t.sessions + ' seans' +
                        (t.type ? ' · ' + t.type : '') +
                        ' · ' + sym + perSession + '/seans' +
                    '</div>' +
                '</div>' +
                '<div style="font-size:1.1rem; font-weight:700; color:var(--sage-dark); flex-shrink:0; margin-left:12px;">' +
                    sym + t.price.toLocaleString('tr-TR') +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'priceListPickerModal';
    modal.className = 'modal active';

    const inner = document.createElement('div');
    inner.className = 'modal-content';
    inner.style.maxWidth = '500px';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h3>&#x1F3F7;&#xFE0F; Fiyat Listesinden Se&#231;</h3>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.onclick = function() { modal.remove(); };
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = cardsHTML;

    inner.appendChild(header);
    inner.appendChild(body);
    modal.appendChild(inner);
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

function applyPriceTemplate(i) {
    const t = priceTemplates[i];
    if (!t) return;
    document.getElementById('packageName').value     = t.name;
    document.getElementById('packageSessions').value = t.sessions;
    document.getElementById('packagePrice').value    = t.price;
    const curSel = document.getElementById('packageCurrency');
    if (curSel && t.currency) curSel.value = t.currency;
    const insSel = document.getElementById('packageInstructor');
    if (insSel && t.instructorId) insSel.value = t.instructorId;
    document.getElementById('priceListPickerModal')?.remove();
    showNotification(t.name + ' seçildi', 'success');
}

window.buildPackageFromPriceList = buildPackageFromPriceList;
window.applyPriceTemplate        = applyPriceTemplate;

// ============================================================
// INIT GÜNCELLEMELER
// ============================================================
// loadExpenses'ı auth sonrası çağır
const _origOnAuth = window._authCallback;
// Expose loadExpenses for init
window._loadExpensesOnInit = async function() {
    await loadExpenses();
    updateFinanceKPIs();
};


// ============================================================
// DÖVİZ BAZLI ÜCRET SİSTEMİ
// ============================================================
const CURRENCIES = {
    TRY: { symbol: '₺', name: 'Türk Lirası', rate: 1 },
    USD: { symbol: '$', name: 'Amerikan Doları', rate: null },
    EUR: { symbol: '€', name: 'Euro', rate: null },
    GBP: { symbol: '£', name: 'İngiliz Sterlini', rate: null },
};

let currentCurrency = 'TRY';
let exchangeRates   = { TRY: 1, USD: null, EUR: null, GBP: null };

// Döviz kurlarını çek (Frankfurter API - ücretsiz)
async function fetchExchangeRates() {
    try {
        const res  = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP');
        const data = await res.json();
        if (data.rates) {
            exchangeRates.USD = data.rates.USD;
            exchangeRates.EUR = data.rates.EUR;
            exchangeRates.GBP = data.rates.GBP;
            exchangeRates.TRY = 1;
            console.log('✅ Döviz kurları güncellendi:', exchangeRates);
        }
    } catch(e) {
        console.warn('Döviz kuru alınamadı:', e);
    }
}

// TRY -> seçili para birimine çevir
function convertAmount(amountTRY, toCurrency) {
    if (!toCurrency || toCurrency === 'TRY') return amountTRY;
    const rate = exchangeRates[toCurrency];
    if (!rate) return amountTRY;
    return amountTRY * rate;
}

// Para birimini formatla
function formatCurrency(amountTRY, currency) {
    currency = currency || currentCurrency;
    const cur = CURRENCIES[currency] || CURRENCIES.TRY;
    const converted = convertAmount(amountTRY, currency);
    return cur.symbol + converted.toFixed(2).replace(/\.00$/, '');
}

// Para birimi seçici modalı
function openCurrencyModal() {
    const existing = document.getElementById('currencyModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'currencyModal';
    modal.className = 'modal active';

    const rateInfo = Object.entries(CURRENCIES).map(([code, cur]) => {
        const rate = exchangeRates[code];
        const rateStr = code === 'TRY' ? '1 ₺ = 1 ₺' :
            rate ? `1 ₺ = ${rate.toFixed(4)} ${cur.symbol}` : 'Kur yükleniyor...';
        return `
        <div onclick="setCurrency('${code}')"
            style="display:flex; align-items:center; justify-content:space-between;
                   padding:14px 16px; background:${currentCurrency===code?'var(--sage-light)':'var(--surface-2)'};
                   border:1.5px solid ${currentCurrency===code?'var(--sage-dark)':'var(--border)'};
                   border-radius:var(--r-md); cursor:pointer; margin-bottom:8px; transition:all .15s;"
            onmouseover="this.style.borderColor='var(--sage-dark)'"
            onmouseout="this.style.borderColor='${currentCurrency===code?'var(--sage-dark)':'var(--border)'}'">
            <div>
                <span style="font-size:22px; margin-right:10px;">${cur.symbol}</span>
                <strong style="font-size:14px;">${code}</strong>
                <span style="font-size:13px; color:var(--stone); margin-left:6px;">${cur.name}</span>
            </div>
            <div style="font-size:12px; color:var(--stone);">${rateStr}</div>
        </div>`;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width:440px;">
            <div class="modal-header">
                <h3>💱 Para Birimi Seç</h3>
                <button class="close-btn" onclick="document.getElementById('currencyModal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <p style="font-size:13px; color:var(--stone); margin-bottom:16px;">
                    Seçilen para birimi tüm tutarları ve raporları etkiler.
                    Kurlar anlık olarak güncellenir.
                </p>
                ${rateInfo}
                <button class="btn btn-secondary btn-sm w-full" style="margin-top:8px;"
                    onclick="fetchExchangeRates().then(() => openCurrencyModal())">
                    🔄 Kurları Güncelle
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

function setCurrency(code) {
    currentCurrency = code;
    try { localStorage.setItem('stulioCurrency', code); } catch(e) {}
    document.getElementById('currencyModal')?.remove();

    // Tüm para tutarlarını güncelle
    renderClients();
    renderFinance();
    updateStats();
    showNotification('Para birimi ' + code + ' olarak ayarlandı', 'success');

    // Currency buton güncelle
    const btn = document.getElementById('currencyBtn');
    if (btn) btn.textContent = '💱 ' + CURRENCIES[code].symbol + ' ' + code;
}

function loadSavedCurrency() {
    try {
        const saved = localStorage.getItem('stulioCurrency');
        if (saved && CURRENCIES[saved]) currentCurrency = saved;
    } catch(e) {}
}

// formatCurrency'yi tüm render'larda kullan
window.formatCurrency    = formatCurrency;
window.convertAmount     = convertAmount;
window.openCurrencyModal = openCurrencyModal;
window.setCurrency       = setCurrency;
window.fetchExchangeRates = fetchExchangeRates;
window.loadSavedCurrency = loadSavedCurrency;
window.currentCurrency   = currentCurrency;

// ============================================================
// TOPLU DANIŞAN SEÇİMİ
// ============================================================
function getSelectedClientIds() {
    return [...document.querySelectorAll('.client-checkbox:checked')].map(cb => cb.dataset.id);
}

function onClientCheckChange() {
    const selected = getSelectedClientIds();
    const bar      = document.getElementById('bulkActionBar');
    const countEl  = document.getElementById('selectedCount');
    const allCb    = document.getElementById('selectAllClients');

    if (bar)    bar.style.display    = selected.length > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent = selected.length + ' danışan seçildi';

    // Tümünü seç checkbox güncelle
    const allBoxes = document.querySelectorAll('.client-checkbox');
    if (allCb) {
        allCb.checked       = allBoxes.length > 0 && selected.length === allBoxes.length;
        allCb.indeterminate = selected.length > 0 && selected.length < allBoxes.length;
    }
}

function toggleSelectAll(checked) {
    document.querySelectorAll('.client-checkbox').forEach(cb => { cb.checked = checked; });
    onClientCheckChange();
}

function clearBulkSelection() {
    document.querySelectorAll('.client-checkbox').forEach(cb => { cb.checked = false; });
    const allCb = document.getElementById('selectAllClients');
    if (allCb) { allCb.checked = false; allCb.indeterminate = false; }
    onClientCheckChange();
}

function bulkWhatsApp() {
    const ids = getSelectedClientIds();
    if (!ids.length) { showNotification('Danışan seçin', 'warning'); return; }

    const items = ids.map(id => {
        const client  = clients.find(c => c.id === id);
        const session = sessions
            .filter(s => s.clientId === id && s.status !== 'absent')
            .sort((a,b) => new Date(b.date)-new Date(a.date))[0];
        return client ? { client, session: session || { date:'', time:'', type:'' } } : null;
    }).filter(Boolean);

    if (!items.length) return;
    window._bulkList = items;
    window._bulkMap  = {};
    items.forEach((x,i) => { window._bulkMap[i] = x; });

    if (typeof sendAllWhatsApp === 'function') sendAllWhatsApp(items);
    clearBulkSelection();
}

function bulkAddPackage() {
    const ids = getSelectedClientIds();
    if (!ids.length) { showNotification('Danışan seçin', 'warning'); return; }
    if (ids.length > 1) {
        showNotification(ids.length + ' danışan için paket eklenecek — sırayla açılacak', 'success');
    }
    // İlk danışan için paket modalını aç
    openAddPackageModal(ids[0]);
    // Sonrakiler için hatırlatma
    if (ids.length > 1) {
        window._pendingBulkPackage = ids.slice(1);
    }
    clearBulkSelection();
}

function bulkAddSession() {
    const ids = getSelectedClientIds();
    if (!ids.length) { showNotification('Danışan seçin', 'warning'); return; }
    // İlk seçili danışan için seans modalını aç
    openAddSessionModal(ids[0]);
    if (ids.length > 1) {
        showNotification(ids.length + ' danışan seçili — ilk danışan için seans açıldı', 'success');
    }
    clearBulkSelection();
}
window.bulkAddSession       = bulkAddSession;
window.getSelectedClientIds = getSelectedClientIds;
window.onClientCheckChange  = onClientCheckChange;
window.toggleSelectAll      = toggleSelectAll;
window.clearBulkSelection   = clearBulkSelection;
window.bulkWhatsApp         = bulkWhatsApp;
window.bulkAddPackage       = bulkAddPackage;

// ============================================================
// HIZLI CHECK-IN — "Geldi ✓"
// ============================================================
function quickCheckIn(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    // Bugünün tarihi
    const now  = new Date();
    const date = now.getFullYear() + '-' +
        String(now.getMonth()+1).padStart(2,'0') + '-' +
        String(now.getDate()).padStart(2,'0');
    const time = String(now.getHours()).padStart(2,'0') + ':' +
        String(now.getMinutes()).padStart(2,'0');

    // Seans türü — aktif paket varsa onun türünü al, yoksa ilk seans türü
    const activePkg = packages.find(p => p.clientId === clientId && p.status === 'active');
    const lastSession = sessions
        .filter(s => s.clientId === clientId)
        .sort((a,b) => new Date(b.date)-new Date(a.date))[0];
    const type = lastSession?.type || (sessionTypes[0] || 'Genel');

    // Bugün zaten check-in yapıldı mı?
    const alreadyToday = sessions.find(s =>
        s.clientId === clientId && s.date === date && s.status !== 'absent'
    );

    if (alreadyToday) {
        if (!confirm(`${client.name} bugün (${time}) zaten ${alreadyToday.type} seansı var.\nYine de yeni seans eklensin mi?`)) return;
    }

    // Paket seçimi - birden fazla aktif varsa sor
    const activePkgs = packages.filter(p => p.clientId === clientId && p.status === 'active');

    if (activePkgs.length > 1) {
        // Birden fazla paket var - hızlı seçim modalı
        openQuickCheckInModal(clientId, client, date, time, type, activePkgs);
    } else {
        // Direkt kaydet
        saveQuickCheckIn(clientId, date, time, type, activePkgs[0]?.id || null);
    }
}

function openQuickCheckInModal(clientId, client, date, time, type, pkgs) {
    const existing = document.getElementById('checkInModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'checkInModal';
    modal.className = 'modal active';

    const inner = document.createElement('div');
    inner.className = 'modal-content';
    inner.style.maxWidth = '420px';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h3>✓ ' + client.name + ' Geldi</h3>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.onclick = () => modal.remove();
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML =
        '<p style="font-size:13px; color:var(--stone); margin-bottom:14px;">Birden fazla aktif paket var, hangisinden düşülsün?</p>' +
        pkgs.map((p, i) =>
            '<div onclick="saveQuickCheckIn(\'' + clientId + '\',\'' + date + '\',\'' + time + '\',\'' + type + '\',\'' + p.id + '\'); document.getElementById(\'checkInModal\').remove()"' +
            ' style="padding:12px 16px; background:var(--surface-2); border-radius:var(--r-md); border:1.5px solid var(--border);' +
            ' cursor:pointer; margin-bottom:8px; transition:all .15s;"' +
            ' onmouseover="this.style.borderColor=\'var(--sage-dark)\'"' +
            ' onmouseout="this.style.borderColor=\'var(--border)\'">' +
            '<div style="font-weight:600; font-size:14px;">' + p.name + '</div>' +
            '<div style="font-size:12px; color:var(--stone); margin-top:3px;">' + (p.remainingSessions || 0) + ' seans kaldı</div>' +
            '</div>'
        ).join('');

    inner.appendChild(header);
    inner.appendChild(body);
    modal.appendChild(inner);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

async function saveQuickCheckIn(clientId, date, time, type, packageId) {
    if (!currentUser) { showNotification('Giriş yapın', 'error'); return; }

    const session = {
        id:        'ci-' + Date.now(),
        clientId,
        date,
        time,
        type,
        duration:  60,
        notes:     '[Hızlı Check-in]',
        status:    'normal',
        createdAt: new Date().toISOString()
    };

    await upsertSession(currentUser.uid, session.id, session);

    // Paketten düş
    if (packageId) {
        const pkg = packages.find(p => p.id === packageId);
        if (pkg && typeof pkg.remainingSessions === 'number' && pkg.remainingSessions > 0) {
            const newRem = pkg.remainingSessions - 1;
            await fbUpdatePackage(currentUser.uid, pkg.id, {
                remainingSessions: newRem,
                status: newRem === 0 ? 'completed' : 'active'
            });
            if (newRem === 0) {
                showPackageWarningToast(clients.find(c=>c.id===clientId), pkg, 0);
            } else if (newRem <= 2) {
                showPackageWarningToast(clients.find(c=>c.id===clientId), pkg, newRem);
            }
        }
    }

    await loadDataFromFirestore(currentUser.uid);
    syncGlobalDataRefs();
    renderClients();
    renderCalendar();
    updateStats();
    document.getElementById('checkInModal')?.remove();

    // Kart üzerinde kısa animasyon
    const card = document.getElementById('card_' + clientId);
    if (card) {
        card.style.transition = 'box-shadow .3s, border-color .3s';
        card.style.boxShadow  = '0 0 0 3px rgba(109,184,157,.4)';
        card.style.borderColor = 'var(--success)';
        setTimeout(() => {
            card.style.boxShadow  = '';
            card.style.borderColor = '';
        }, 2000);
    }

    const client = clients.find(c => c.id === clientId);
    showNotification((client?.name || 'Danışan') + ' — ' + time + ' check-in kaydedildi ✓', 'success');
}

window.quickCheckIn         = quickCheckIn;
window.saveQuickCheckIn     = saveQuickCheckIn;
window.openQuickCheckInModal = openQuickCheckInModal;

// ============================================================
// HIZLI TARİH ARALIĞI SEÇİMİ
// ============================================================
function setDateRangePreset(preset) {
    const today = new Date();
    const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

    let from, to;

    switch(preset) {
        case 'today':
            from = to = fmt(today);
            break;
        case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            from = fmt(weekAgo);
            to   = fmt(today);
            break;
        }
        case 'thisMonth': {
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            from = fmt(first);
            to   = fmt(today);
            break;
        }
        case 'lastMonth': {
            const firstLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastLast  = new Date(today.getFullYear(), today.getMonth(), 0);
            from = fmt(firstLast);
            to   = fmt(lastLast);
            break;
        }
    }

    const fromEl = document.getElementById('financeFromDate');
    const toEl   = document.getElementById('financeToDate');
    if (fromEl) fromEl.value = from;
    if (toEl)   toEl.value   = to;

    renderPaymentHistory();
}
window.setDateRangePreset = setDateRangePreset;

// ============================================================
// EĞİTMEN / HOCA YÖNETİM SİSTEMİ
// ============================================================
let instructors = [];

async function loadInstructors() {
    if (currentUser) {
        try {
            const profile = await getProfile(currentUser.uid);
            if (profile?.instructors?.length) {
                instructors = profile.instructors;
                try { localStorage.setItem('instructors_' + currentUser.uid, JSON.stringify(instructors)); } catch(e) {}
                return;
            }
        } catch(e) { console.warn('Eğitmen Firestore hatası:', e); }
    }
    try {
        const uid = currentUser?.uid || 'guest';
        const stored = localStorage.getItem('instructors_' + uid);
        if (stored) instructors = JSON.parse(stored);
    } catch(e) { instructors = []; }
}

async function saveInstructors() {
    const uid = currentUser?.uid || 'guest';
    try { localStorage.setItem('instructors_' + uid, JSON.stringify(instructors)); } catch(e) {}
    if (currentUser) {
        try { await saveProfile(currentUser.uid, { instructors }); }
        catch(e) { console.error('Eğitmen kayıt hatası:', e); }
    }
}

function openInstructorsModal() {
    const existing = document.getElementById('instructorsModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'instructorsModal';
    modal.className = 'modal active';

    const inner = document.createElement('div');
    inner.className = 'modal-content';
    inner.style.maxWidth = '520px';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h3>👩‍🏫 Eğitmenler / Hocalar</h3>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.onclick = () => modal.remove();
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.id = 'instructorsBody';

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const closeBtn2 = document.createElement('button');
    closeBtn2.className = 'btn btn-secondary';
    closeBtn2.textContent = 'Kapat';
    closeBtn2.onclick = () => modal.remove();
    footer.appendChild(closeBtn2);

    inner.appendChild(header);
    inner.appendChild(body);
    inner.appendChild(footer);
    modal.appendChild(inner);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);

    renderInstructorsList();
}

function renderInstructorsList() {
    const body = document.getElementById('instructorsBody');
    if (!body) return;

    const listHTML = instructors.length ? instructors.map((ins, i) => `
        <div style="display:flex; align-items:center; gap:10px; padding:12px 14px;
             background:var(--surface-2); border-radius:var(--r-md); border:1px solid var(--border-soft); margin-bottom:8px;">
            <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,var(--lav-light),var(--sage-light));
                 display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">👤</div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:14px;">${ins.name}</div>
                <div style="font-size:12px; color:var(--stone);">${ins.specialty || 'Genel'} · %${ins.commission} komisyon</div>
            </div>
            <button class="btn btn-ghost btn-xs" onclick="editInstructor(${i})">✏️</button>
            <button class="btn btn-ghost btn-xs" onclick="removeInstructor(${i})" style="color:var(--danger);">🗑</button>
        </div>`).join('') : '<div style="text-align:center; color:var(--stone); padding:20px; font-size:13px;">Henüz eğitmen eklenmedi</div>';

    body.innerHTML = `
        ${listHTML}
        <div class="divider"></div>
        <div class="form-group">
            <label>Eğitmen Adı *</label>
            <input type="text" id="newInsName" placeholder="Örn: Ayşe Hoca">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Uzmanlık</label>
                <input type="text" id="newInsSpecialty" placeholder="Örn: Pilates, Yoga">
            </div>
            <div class="form-group">
                <label>Komisyon (%) *</label>
                <input type="number" id="newInsCommission" placeholder="40" min="0" max="100">
            </div>
        </div>
        <button class="btn btn-primary btn-sm w-full" onclick="addInstructor()">＋ Eğitmen Ekle</button>
    `;
}

function addInstructor() {
    const name       = document.getElementById('newInsName')?.value.trim();
    const specialty  = document.getElementById('newInsSpecialty')?.value.trim();
    const commission = parseFloat(document.getElementById('newInsCommission')?.value);

    if (!name || isNaN(commission)) {
        showNotification('Ad ve komisyon yüzdesi zorunlu', 'error');
        return;
    }

    instructors.push({
        id: 'ins-' + Date.now(),
        name, specialty, commission
    });
    saveInstructors();
    renderInstructorsList();
    updateInstructorSelects();
    showNotification(name + ' eklendi ✓', 'success');
}

function editInstructor(i) {
    const ins = instructors[i];
    if (!ins) return;
    const newCommission = prompt('Yeni komisyon yüzdesi:', ins.commission);
    if (newCommission === null) return;
    const val = parseFloat(newCommission);
    if (isNaN(val)) { showNotification('Geçersiz değer', 'error'); return; }
    ins.commission = val;
    saveInstructors();
    renderInstructorsList();
    showNotification('Güncellendi ✓', 'success');
}

async function removeInstructor(i) {
    if (!confirm('Bu eğitmeni silmek istiyor musunuz?')) return;
    instructors.splice(i, 1);
    await saveInstructors();
    renderInstructorsList();
    updateInstructorSelects();
}

function updateInstructorSelects() {
    // Fiyat listesi modalı, seans modalı, paket modalı içindeki select'leri güncelle
    const selectIds = ['pt_instructor', 'sessionInstructor', 'packageInstructor'];
    selectIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = '<option value="">— Eğitmen Yok —</option>' +
            instructors.map(ins => `<option value="${ins.id}" ${ins.id === current ? 'selected' : ''}>${ins.name} (%${ins.commission})</option>`).join('');
    });
}

window.openInstructorsModal  = openInstructorsModal;
window.renderInstructorsList = renderInstructorsList;
window.addInstructor         = addInstructor;
window.editInstructor        = editInstructor;
window.removeInstructor      = removeInstructor;
window.loadInstructors       = loadInstructors;
window.saveInstructors       = saveInstructors;
window.updateInstructorSelects = updateInstructorSelects;

// ============================================================
// EĞİTMEN RAPORLAMA SİSTEMİ
// ============================================================
function renderInstructorReports() {
    const container = document.getElementById('reportsContainer');
    if (!container) return;

    // Filtre dropdown'unu güncelle
    const filterSel = document.getElementById('reportInstructorFilter');
    if (filterSel && filterSel.options.length <= 1) {
        filterSel.innerHTML = '<option value="all">Tüm Eğitmenler</option>' +
            instructors.map(ins => `<option value="${ins.id}">${ins.name}</option>`).join('');
    }
    const selectedInsId = filterSel?.value || 'all';

    if (!instructors.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding:60px 20px;">
                <div class="empty-state-icon">👩‍🏫</div>
                <p>Henüz eğitmen eklenmemiş</p>
                <button class="btn btn-primary btn-sm" style="margin-top:12px;"
                    onclick="document.getElementById('settingsModal') ? null : openSettings(); setTimeout(()=>openInstructorsModal(), 100)">
                    ＋ Eğitmen Ekle
                </button>
            </div>`;
        return;
    }

    // Her eğitmen için: paketleri, ödemeleri, danışanları hesapla
    const insToShow = selectedInsId === 'all' ? instructors : instructors.filter(i => i.id === selectedInsId);

    const reportCards = insToShow.map(ins => {
        // Bu eğitmene ait paketler
        const insPackages = packages.filter(p => p.instructorId === ins.id);
        const insClientIds = [...new Set(insPackages.map(p => p.clientId))];
        const insClients = insClientIds.map(id => clients.find(c => c.id === id)).filter(Boolean);

        // Bu paketlere yapılan ödemeler
        const insPaymentsTotal = insPackages.reduce((sum, pkg) => {
            const pkgPayments = payments.filter(p => p.packageId === pkg.id);
            return sum + pkgPayments.reduce((s,p) => s + p.amount, 0);
        }, 0);

        // Toplam paket değeri (kazanılacak)
        const totalPackageValue = insPackages.reduce((s,p) => s + (p.price||0), 0);

        // Komisyon hesabı
        const commission       = ins.commission || 0;
        const instructorShare  = insPaymentsTotal * (commission / 100);
        const businessShare    = insPaymentsTotal - instructorShare;

        // Aktif/tamamlanan seans sayısı
        const insSessions = sessions.filter(s => insClientIds.includes(s.clientId) && s.status !== 'absent');

        window._reportInsMap = window._reportInsMap || {};
        window._reportInsMap[ins.id] = { ins, insClients, insPackages };

        return `
        <div class="card" style="margin-bottom:20px;">
            <div class="card-header" onclick="toggleSection('insSection_${ins.id}', 'insChevron_${ins.id}')" style="cursor:pointer; user-select:none;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span id="insChevron_${ins.id}" style="font-size:12px; color:var(--stone); transition:transform .2s;">▼</span>
                    <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,var(--lav-light),var(--sage-light));
                         display:flex; align-items:center; justify-content:center; font-size:18px;">👤</div>
                    <div>
                        <h2 style="margin:0;">${ins.name}</h2>
                        <div style="font-size:12px; color:var(--stone);">${ins.specialty || 'Genel'} · %${commission} komisyon</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="text-align:right;">
                        <div style="font-family:'Playfair Display',serif; font-size:1.4rem; font-weight:600; color:var(--sage-dark);">
                            ${typeof formatCurrency === 'function' ? formatCurrency(instructorShare) : instructorShare.toFixed(0) + ' ₺'}
                        </div>
                        <div style="font-size:11px; color:var(--stone);">eğitmen payı</div>
                    </div>
                    <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation(); generateInstructorReportPDF('${ins.id}')" title="Bu eğitmenin raporu">🖨️</button>
                </div>
            </div>

            <div id="insSection_${ins.id}">
                <!-- KPI Grid -->
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--border-soft); margin-bottom:0;">
                    <div style="background:var(--surface); padding:16px; text-align:center;">
                        <div style="font-size:11px; color:var(--stone); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Danışan</div>
                        <div style="font-size:1.4rem; font-weight:700; color:var(--ink); font-family:'Playfair Display',serif;">${insClients.length}</div>
                    </div>
                    <div style="background:var(--surface); padding:16px; text-align:center;">
                        <div style="font-size:11px; color:var(--stone); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Toplam Ciro</div>
                        <div style="font-size:1.4rem; font-weight:700; color:var(--ink); font-family:'Playfair Display',serif;">
                            ${typeof formatCurrency === 'function' ? formatCurrency(insPaymentsTotal) : insPaymentsTotal.toFixed(0) + ' ₺'}
                        </div>
                    </div>
                    <div style="background:var(--surface); padding:16px; text-align:center;">
                        <div style="font-size:11px; color:var(--stone); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Eğitmen Payı</div>
                        <div style="font-size:1.4rem; font-weight:700; color:var(--sage-dark); font-family:'Playfair Display',serif;">
                            ${typeof formatCurrency === 'function' ? formatCurrency(instructorShare) : instructorShare.toFixed(0) + ' ₺'}
                        </div>
                    </div>
                    <div style="background:var(--surface); padding:16px; text-align:center;">
                        <div style="font-size:11px; color:var(--stone); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">İşletme Payı</div>
                        <div style="font-size:1.4rem; font-weight:700; color:var(--lav-dark); font-family:'Playfair Display',serif;">
                            ${typeof formatCurrency === 'function' ? formatCurrency(businessShare) : businessShare.toFixed(0) + ' ₺'}
                        </div>
                    </div>
                </div>

                <!-- Danışan listesi -->
                <div class="card-body" style="padding:0;">
                    ${insClients.length ? `
                    <table class="finance-table">
                        <thead><tr><th>Danışan</th><th>Paket</th><th>Toplam Tutar</th><th>Ödenen</th><th>Eğitmen Payı</th></tr></thead>
                        <tbody>
                        ${insPackages.map(pkg => {
                            const c = clients.find(c => c.id === pkg.clientId);
                            if (!c) return '';
                            const pkgPaid = payments.filter(p => p.packageId === pkg.id).reduce((s,p) => s+p.amount, 0);
                            const pkgInsShare = pkgPaid * (commission / 100);
                            const sym = pkg.priceCurrency === 'USD' ? '$' : pkg.priceCurrency === 'EUR' ? '€' : pkg.priceCurrency === 'GBP' ? '£' : '₺';
                            return `<tr>
                                <td><strong>${c.name}</strong></td>
                                <td style="color:var(--stone); font-size:13px;">${pkg.name}</td>
                                <td>${sym}${(pkg.price||0).toFixed(0)}</td>
                                <td>${sym}${pkgPaid.toFixed(0)}</td>
                                <td><strong style="color:var(--sage-dark);">${sym}${pkgInsShare.toFixed(0)}</strong></td>
                            </tr>`;
                        }).join('')}
                        </tbody>
                    </table>` : '<div class="empty-state" style="padding:24px;"><p>Bu eğitmene atanmış danışan yok</p></div>'}
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = reportCards;
}

window.renderInstructorReports = renderInstructorReports;

// ============================================================
// EĞİTMEN RAPORU - PDF OLUŞTUR
// ============================================================
function generateInstructorReportPDF(scope) {
    // scope: 'all' veya bir instructor id
    scope = scope || document.getElementById('reportInstructorFilter')?.value || 'all';

    const profile    = window._currentProfile || {};
    const bizName    = profile.businessName || 'İşletme';
    const bizTagline = profile.tagline || '';
    const today      = new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });

    const insToShow = scope === 'all' ? instructors : instructors.filter(i => i.id === scope);

    if (!insToShow.length) {
        showNotification('Eğitmen bulunamadı', 'warning');
        return;
    }

    // Her eğitmen için detaylı veri hesapla
    const reportData = insToShow.map(ins => {
        const insPackages  = packages.filter(p => p.instructorId === ins.id);
        const insClientIds = [...new Set(insPackages.map(p => p.clientId))];
        const insClients   = insClientIds.map(id => clients.find(c => c.id === id)).filter(Boolean);

        const lineItems = insPackages.map(pkg => {
            const c = clients.find(c => c.id === pkg.clientId);
            if (!c) return null;
            const pkgPayments = payments.filter(p => p.packageId === pkg.id);
            const pkgPaid     = pkgPayments.reduce((s,p) => s+p.amount, 0);
            const pkgInsShare = pkgPaid * ((ins.commission||0) / 100);
            const pkgBizShare = pkgPaid - pkgInsShare;
            return {
                clientName: c.name,
                packageName: pkg.name,
                totalPrice: pkg.price || 0,
                currency: pkg.priceCurrency || 'TRY',
                paid: pkgPaid,
                insShare: pkgInsShare,
                bizShare: pkgBizShare,
                startDate: pkg.startDate,
                status: pkg.status
            };
        }).filter(Boolean);

        const totalPaid     = lineItems.reduce((s,x) => s+x.paid, 0);
        const totalInsShare = lineItems.reduce((s,x) => s+x.insShare, 0);
        const totalBizShare = lineItems.reduce((s,x) => s+x.bizShare, 0);
        const totalPkgValue = lineItems.reduce((s,x) => s+x.totalPrice, 0);

        return { ins, lineItems, insClients, totalPaid, totalInsShare, totalBizShare, totalPkgValue };
    });

    // Genel toplam
    const grandTotalPaid     = reportData.reduce((s,r) => s+r.totalPaid, 0);
    const grandTotalInsShare = reportData.reduce((s,r) => s+r.totalInsShare, 0);
    const grandTotalBizShare = reportData.reduce((s,r) => s+r.totalBizShare, 0);

    const symFor = (cur) => cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '₺';

    // HTML oluştur
    const sectionsHTML = reportData.map(r => `
        <div style="margin-bottom:36px; page-break-inside:avoid;">
            <div style="display:flex; justify-content:space-between; align-items:center;
                 padding:16px 20px; background:linear-gradient(135deg,#f0ede6,#e8e2db); border-radius:10px; margin-bottom:14px;">
                <div>
                    <div style="font-family:'Playfair Display',serif; font-size:1.3rem; font-weight:600; color:#2d3340;">${r.ins.name}</div>
                    <div style="font-size:12px; color:#6b7a86; margin-top:2px;">${r.ins.specialty || 'Genel'} · %${r.ins.commission} komisyon · ${r.insClients.length} danışan</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px; color:#6b7a86; text-transform:uppercase; letter-spacing:.05em;">Eğitmen Payı</div>
                    <div style="font-family:'Playfair Display',serif; font-size:1.5rem; font-weight:700; color:#5f8076;">
                        ${r.totalInsShare.toFixed(2)} ₺
                    </div>
                </div>
            </div>

            ${r.lineItems.length ? `
            <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                    <tr style="background:#2d3340; color:white;">
                        <th style="padding:9px 12px; text-align:left; font-weight:600;">Danışan</th>
                        <th style="padding:9px 12px; text-align:left; font-weight:600;">Paket</th>
                        <th style="padding:9px 12px; text-align:right; font-weight:600;">Toplam</th>
                        <th style="padding:9px 12px; text-align:right; font-weight:600;">Tahsil Edilen</th>
                        <th style="padding:9px 12px; text-align:right; font-weight:600;">Eğitmen Payı</th>
                        <th style="padding:9px 12px; text-align:right; font-weight:600;">İşletme Payı</th>
                    </tr>
                </thead>
                <tbody>
                    ${r.lineItems.map((x, i) => `
                    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f7f5f1'}; border-bottom:1px solid #e8e2db;">
                        <td style="padding:8px 12px; font-weight:600;">${x.clientName}</td>
                        <td style="padding:8px 12px; color:#6b7a86;">${x.packageName}</td>
                        <td style="padding:8px 12px; text-align:right;">${symFor(x.currency)}${x.totalPrice.toFixed(0)}</td>
                        <td style="padding:8px 12px; text-align:right;">${symFor(x.currency)}${x.paid.toFixed(0)}</td>
                        <td style="padding:8px 12px; text-align:right; color:#5f8076; font-weight:600;">${symFor(x.currency)}${x.insShare.toFixed(0)}</td>
                        <td style="padding:8px 12px; text-align:right; color:#8a7ab8;">${symFor(x.currency)}${x.bizShare.toFixed(0)}</td>
                    </tr>`).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f0ede6; font-weight:700;">
                        <td colspan="2" style="padding:10px 12px;">TOPLAM</td>
                        <td style="padding:10px 12px; text-align:right;">${r.totalPkgValue.toFixed(0)} ₺</td>
                        <td style="padding:10px 12px; text-align:right;">${r.totalPaid.toFixed(0)} ₺</td>
                        <td style="padding:10px 12px; text-align:right; color:#5f8076;">${r.totalInsShare.toFixed(0)} ₺</td>
                        <td style="padding:10px 12px; text-align:right; color:#8a7ab8;">${r.totalBizShare.toFixed(0)} ₺</td>
                    </tr>
                </tfoot>
            </table>` : '<div style="padding:20px; text-align:center; color:#6b7a86; font-size:13px;">Bu eğitmene ait kayıt yok</div>'}
        </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8">
<title>Eğitmen Raporu</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'DM Sans',sans-serif; background:#f5f3f0; color:#2d3340; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
@media print { body { background:white; } .no-print { display:none !important; } .page { box-shadow:none !important; margin:0 !important; } }
.page { max-width:880px; margin:24px auto; background:white; padding:48px 56px; box-shadow:0 4px 24px rgba(0,0,0,.08); border-radius:8px; }
</style></head>
<body>
<div class="page">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; padding-bottom:24px; border-bottom:2px solid #2d3340;">
        <div>
            <div style="font-family:'Playfair Display',serif; font-size:1.8rem; font-weight:700; color:#2d3340;">${bizName}</div>
            <div style="font-size:13px; color:#6b7a86; margin-top:2px;">${bizTagline}</div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:11px; color:#6b7a86; text-transform:uppercase; letter-spacing:.08em;">Eğitmen Raporu</div>
            <div style="font-size:13px; color:#2d3340; margin-top:2px;">${today}</div>
        </div>
    </div>

    <!-- Genel özet -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:#e8e2db; margin:28px 0; border-radius:8px; overflow:hidden;">
        <div style="background:white; padding:18px; text-align:center;">
            <div style="font-size:11px; color:#6b7a86; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Toplam Tahsilat</div>
            <div style="font-family:'Playfair Display',serif; font-size:1.6rem; font-weight:700;">${grandTotalPaid.toFixed(0)} ₺</div>
        </div>
        <div style="background:white; padding:18px; text-align:center;">
            <div style="font-size:11px; color:#6b7a86; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Eğitmen Payları</div>
            <div style="font-family:'Playfair Display',serif; font-size:1.6rem; font-weight:700; color:#5f8076;">${grandTotalInsShare.toFixed(0)} ₺</div>
        </div>
        <div style="background:white; padding:18px; text-align:center;">
            <div style="font-size:11px; color:#6b7a86; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">İşletme Payı</div>
            <div style="font-family:'Playfair Display',serif; font-size:1.6rem; font-weight:700; color:#8a7ab8;">${grandTotalBizShare.toFixed(0)} ₺</div>
        </div>
    </div>

    ${sectionsHTML}

    <div style="margin-top:40px; padding-top:16px; border-top:1px solid #e8e2db; font-size:11px; color:#9aa5ad; text-align:center;">
        ${bizName} tarafından oluşturulmuştur · ${today}
    </div>
</div>
<div class="no-print" style="text-align:center; padding:16px; background:#f0ede8; border-top:1px solid #ddd8d2;">
    <button onclick="window.print()" style="padding:11px 28px; background:#5f8076; color:white;
        border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; margin-right:8px;">
        🖨️ PDF Kaydet / Yazdır
    </button>
    <button onclick="window.close()" style="padding:11px 20px; background:#e8e2db; color:#2d3340;
        border:none; border-radius:8px; font-size:14px; cursor:pointer;">
        Kapat
    </button>
</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showNotification('Pop-up engellendi — tarayıcı izni verin', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 900);
}

window.generateInstructorReportPDF = generateInstructorReportPDF;

// ============================================================
// RAPORLAMA - SEKME SİSTEMİ
// ============================================================
function switchReportTab(tab) {
    ['instructors','monthly','yearly','clients'].forEach(t => {
        const sec = document.getElementById('reportSection_' + t);
        const btn = document.getElementById('rtab_' + t);
        if (sec) sec.style.display = t === tab ? 'block' : 'none';
        if (btn) {
            btn.style.borderBottomColor = t === tab ? 'var(--sage-dark)' : 'transparent';
            btn.style.color             = t === tab ? 'var(--sage-dark)' : 'var(--stone)';
        }
    });

    if (tab === 'monthly')    { initMonthFilter();  renderMonthlyReport(); }
    if (tab === 'yearly')     { initYearFilter();   renderYearlyReport(); }
    if (tab === 'clients')    { renderClientReport(); }
    if (tab === 'instructors') renderInstructorReports();
}
window.switchReportTab = switchReportTab;

// ── AYLIK RAPOR ──────────────────────────────────────────────
function initMonthFilter() {
    const sel = document.getElementById('reportMonthFilter');
    if (!sel || sel.options.length > 1) return;
    const months = [...new Set(payments.map(p => p.date?.slice(0,7)))].filter(Boolean).sort().reverse();
    const names  = ['','Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    sel.innerHTML = months.map(m => {
        const [y, mo] = m.split('-');
        return `<option value="${m}">${names[parseInt(mo)]} ${y}</option>`;
    }).join('');
    if (!sel.value && months[0]) sel.value = months[0];
}

function renderMonthlyReport() {
    const container = document.getElementById('monthlyReportContainer');
    if (!container) return;
    const month = document.getElementById('reportMonthFilter')?.value;
    if (!month) { container.innerHTML = '<div class="empty-state"><p>Ay seçin</p></div>'; return; }

    const [y, mo] = month.split('-');
    const names   = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const monthLabel = names[parseInt(mo)] + ' ' + y;

    const monthPayments = payments.filter(p => p.date?.startsWith(month));
    const monthSessions = sessions.filter(s => s.date?.startsWith(month) && s.status !== 'absent');
    const monthClients  = [...new Set(monthSessions.map(s => s.clientId))];
    const totalRevenue  = monthPayments.reduce((s,p) => s+p.amount, 0);
    const totalExpenses = (typeof expenses !== 'undefined' ? expenses : []).filter(e => e.date?.startsWith(month)).reduce((s,e) => s+e.amount, 0);
    const netProfit     = totalRevenue - totalExpenses;

    // Hoca bazlı özet
    const insBreakdown = instructors.map(ins => {
        const insPkgs   = packages.filter(p => p.instructorId === ins.id);
        const insPkgIds = insPkgs.map(p => p.id);
        const insPays   = monthPayments.filter(p => insPkgIds.includes(p.packageId));
        const insRev    = insPays.reduce((s,p) => s+p.amount, 0);
        const insShare  = insRev * (ins.commission/100);
        return { ins, revenue: insRev, share: insShare };
    }).filter(r => r.revenue > 0);

    // Ödeme yöntemi dağılımı
    const methodBreakdown = {};
    monthPayments.forEach(p => {
        const m = p.method || 'Diğer';
        methodBreakdown[m] = (methodBreakdown[m] || 0) + p.amount;
    });

    container.innerHTML = `
        <!-- KPI -->
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px;">
            <div class="finance-card">
                <h3>Toplam Gelir</h3>
                <div class="amount">${totalRevenue.toFixed(0)} ₺</div>
                <div style="font-size:12px; color:var(--stone); margin-top:4px;">${monthPayments.length} ödeme</div>
            </div>
            <div class="finance-card">
                <h3>Seans Sayısı</h3>
                <div class="amount">${monthSessions.length}</div>
                <div style="font-size:12px; color:var(--stone); margin-top:4px;">${monthClients.length} danışan</div>
            </div>
            <div class="finance-card">
                <h3>Giderler</h3>
                <div class="amount" style="color:var(--danger);">${totalExpenses.toFixed(0)} ₺</div>
                <div style="font-size:12px; color:var(--stone); margin-top:4px;">Bu ay</div>
            </div>
            <div class="finance-card">
                <h3>Net Kâr</h3>
                <div class="amount" style="color:${netProfit >= 0 ? 'var(--sage-dark)' : 'var(--danger)'};">${netProfit.toFixed(0)} ₺</div>
                <div style="font-size:12px; color:var(--stone); margin-top:4px;">Gelir - Gider</div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
            <!-- Eğitmen dağılımı -->
            <div class="card">
                <div class="card-header"><h3>👩‍🏫 Eğitmen Bazlı Ciro</h3></div>
                <div class="card-body" style="padding:0;">
                    ${insBreakdown.length ? `
                    <table class="finance-table">
                        <thead><tr><th>Eğitmen</th><th>Komisyon</th><th>Ciro</th><th>Pay</th></tr></thead>
                        <tbody>
                        ${insBreakdown.map(r => `<tr>
                            <td><strong>${r.ins.name}</strong></td>
                            <td>%${r.ins.commission}</td>
                            <td>${r.revenue.toFixed(0)} ₺</td>
                            <td style="color:var(--sage-dark); font-weight:600;">${r.share.toFixed(0)} ₺</td>
                        </tr>`).join('')}
                        </tbody>
                    </table>` : '<div style="padding:20px; text-align:center; color:var(--stone); font-size:13px;">Eğitmen kaydı yok</div>'}
                </div>
            </div>

            <!-- Ödeme yöntemi -->
            <div class="card">
                <div class="card-header"><h3>💳 Ödeme Yöntemi</h3></div>
                <div class="card-body" style="padding:0;">
                    <table class="finance-table">
                        <thead><tr><th>Yöntem</th><th>Tutar</th><th>Pay</th></tr></thead>
                        <tbody>
                        ${Object.entries(methodBreakdown).map(([m, v]) => `<tr>
                            <td>${m}</td>
                            <td>${v.toFixed(0)} ₺</td>
                            <td style="color:var(--stone); font-size:12px;">%${((v/totalRevenue)*100).toFixed(1)}</td>
                        </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Ödemeler listesi -->
        <div class="card">
            <div class="card-header">
                <h3>💳 ${monthLabel} Ödemeleri</h3>
                <span style="font-size:13px; color:var(--stone);">${monthPayments.length} kayıt</span>
            </div>
            <div class="card-body" style="padding:0;">
                ${monthPayments.length ? `
                <table class="finance-table">
                    <thead><tr><th>Danışan</th><th>Paket</th><th>Tarih</th><th>Yöntem</th><th>Tutar</th></tr></thead>
                    <tbody>
                    ${[...monthPayments].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p => {
                        const c   = clients.find(c => c.id === p.clientId);
                        const pkg = packages.find(pk => pk.id === p.packageId);
                        return `<tr>
                            <td><strong>${c?.name || '—'}</strong></td>
                            <td style="color:var(--stone); font-size:13px;">${pkg?.name || '—'}</td>
                            <td>${new Date(p.date).toLocaleDateString('tr-TR')}</td>
                            <td>${p.method || '—'}</td>
                            <td><strong style="color:var(--sage-dark);">${p.amount.toFixed(0)} ₺</strong></td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>` : '<div class="empty-state" style="padding:24px;"><p>Bu ay ödeme yok</p></div>'}
            </div>
        </div>`;
}

// ── YILLIK RAPOR ─────────────────────────────────────────────
function initYearFilter() {
    const sel = document.getElementById('reportYearFilter');
    if (!sel || sel.options.length > 1) return;
    const years = [...new Set(payments.map(p => p.date?.slice(0,4)))].filter(Boolean).sort().reverse();
    sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    if (!sel.value && years[0]) sel.value = years[0];
}

function renderYearlyReport() {
    const container = document.getElementById('yearlyReportContainer');
    if (!container) return;
    const year = document.getElementById('reportYearFilter')?.value;
    if (!year) { container.innerHTML = '<div class="empty-state"><p>Yıl seçin</p></div>'; return; }

    const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

    const yearPayments = payments.filter(p => p.date?.startsWith(year));
    const yearSessions = sessions.filter(s => s.date?.startsWith(year) && s.status !== 'absent');
    const yearClients  = [...new Set(yearPayments.map(p => p.clientId))];
    const totalRev     = yearPayments.reduce((s,p) => s+p.amount, 0);
    const yearExpenses = (typeof expenses !== 'undefined' ? expenses : []).filter(e => e.date?.startsWith(year));
    const totalExp     = yearExpenses.reduce((s,e) => s+e.amount, 0);

    // Ay ay dağılım
    const monthlyData = Array.from({length:12}, (_,i) => {
        const m   = year + '-' + String(i+1).padStart(2,'0');
        const rev = yearPayments.filter(p => p.date?.startsWith(m)).reduce((s,p) => s+p.amount, 0);
        const exp = yearExpenses.filter(e => e.date?.startsWith(m)).reduce((s,e) => s+e.amount, 0);
        const ses = yearSessions.filter(s => s.date?.startsWith(m)).length;
        return { month: monthNames[i], rev, exp, net: rev-exp, ses };
    });

    const maxRev = Math.max(...monthlyData.map(d => d.rev), 1);

    container.innerHTML = `
        <!-- KPI -->
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px;">
            <div class="finance-card">
                <h3>${year} Yıl Geliri</h3>
                <div class="amount">${totalRev.toFixed(0)} ₺</div>
                <div style="font-size:12px; color:var(--stone); margin-top:4px;">${yearPayments.length} ödeme</div>
            </div>
            <div class="finance-card">
                <h3>Toplam Seans</h3>
                <div class="amount">${yearSessions.length}</div>
                <div style="font-size:12px; color:var(--stone); margin-top:4px;">${yearClients.length} danışan</div>
            </div>
            <div class="finance-card">
                <h3>Toplam Gider</h3>
                <div class="amount" style="color:var(--danger);">${totalExp.toFixed(0)} ₺</div>
            </div>
            <div class="finance-card">
                <h3>Net Kâr</h3>
                <div class="amount" style="color:var(--sage-dark);">${(totalRev-totalExp).toFixed(0)} ₺</div>
            </div>
        </div>

        <!-- Bar grafik -->
        <div class="card" style="margin-bottom:20px;">
            <div class="card-header"><h3>📈 Aylık Gelir Trendi</h3></div>
            <div class="card-body">
                <div style="display:flex; align-items:flex-end; gap:6px; height:120px; padding-bottom:24px; position:relative;">
                    ${monthlyData.map(d => `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                        <div style="font-size:10px; color:var(--stone); margin-bottom:4px;">${d.rev > 0 ? d.rev.toFixed(0) : ''}</div>
                        <div style="width:100%; background:var(--sage); border-radius:4px 4px 0 0;
                             height:${Math.round((d.rev/maxRev)*80)}px; min-height:${d.rev>0?2:0}px; transition:height .3s;"></div>
                        <div style="font-size:9px; color:var(--stone); margin-top:4px;">${d.month.slice(0,3)}</div>
                    </div>`).join('')}
                </div>
            </div>
        </div>

        <!-- Ay ay tablo -->
        <div class="card">
            <div class="card-header"><h3>📅 Ay Bazlı Özet</h3></div>
            <div class="card-body" style="padding:0;">
                <table class="finance-table">
                    <thead><tr><th>Ay</th><th>Gelir</th><th>Gider</th><th>Net Kâr</th><th>Seans</th></tr></thead>
                    <tbody>
                    ${monthlyData.map(d => `<tr>
                        <td><strong>${d.month}</strong></td>
                        <td style="color:var(--sage-dark);">${d.rev > 0 ? d.rev.toFixed(0)+' ₺' : '—'}</td>
                        <td style="color:var(--danger);">${d.exp > 0 ? d.exp.toFixed(0)+' ₺' : '—'}</td>
                        <td style="font-weight:600; color:${d.net>=0?'var(--sage-dark)':'var(--danger)'};">${d.rev>0||d.exp>0 ? d.net.toFixed(0)+' ₺' : '—'}</td>
                        <td>${d.ses > 0 ? d.ses : '—'}</td>
                    </tr>`).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight:700; background:var(--surface-2);">
                            <td>TOPLAM</td>
                            <td style="color:var(--sage-dark);">${totalRev.toFixed(0)} ₺</td>
                            <td style="color:var(--danger);">${totalExp.toFixed(0)} ₺</td>
                            <td style="color:var(--sage-dark);">${(totalRev-totalExp).toFixed(0)} ₺</td>
                            <td>${yearSessions.length}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>`;
}

// ── DANIŞAN RAPORU ────────────────────────────────────────────
function renderClientReport() {
    const container = document.getElementById('clientReportContainer');
    if (!container) return;
    const search = (document.getElementById('reportClientSearch')?.value || '').toLowerCase().trim();

    let filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search));

    const rows = filtered.map(c => {
        const cSessions = sessions.filter(s => s.clientId === c.id && s.status !== 'absent');
        const cAbsent   = sessions.filter(s => s.clientId === c.id && s.status === 'absent');
        const cPackages = packages.filter(p => p.clientId === c.id);
        const cPayments = payments.filter(p => p.clientId === c.id);
        const totalPaid = cPayments.reduce((s,p) => s+p.amount, 0);
        const totalDebt = cPackages.reduce((s,p) => s+Math.max(0,(p.price||0)-(p.paidAmount||0)), 0);
        const lastSes   = cSessions.sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
        const ins       = cPackages[0]?.instructorId ? instructors.find(i => i.id === cPackages[0].instructorId) : null;

        return { c, cSessions, cAbsent, cPackages, cPayments, totalPaid, totalDebt, lastSes, ins };
    });

    container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px;">
            <div class="finance-card">
                <h3>Toplam Danışan</h3>
                <div class="amount">${filtered.length}</div>
            </div>
            <div class="finance-card">
                <h3>Toplam Tahsilat</h3>
                <div class="amount">${rows.reduce((s,r)=>s+r.totalPaid,0).toFixed(0)} ₺</div>
            </div>
            <div class="finance-card">
                <h3>Toplam Borç</h3>
                <div class="amount" style="color:var(--danger);">${rows.reduce((s,r)=>s+r.totalDebt,0).toFixed(0)} ₺</div>
            </div>
        </div>
        <div class="card">
            <div class="card-body" style="padding:0;">
                <table class="finance-table">
                    <thead><tr><th>Danışan</th><th>Eğitmen</th><th>Seans</th><th>Dev.</th><th>Tahsilat</th><th>Borç</th><th>Son Seans</th></tr></thead>
                    <tbody>
                    ${rows.map(r => `<tr>
                        <td><strong>${r.c.name}</strong><br><span style="font-size:11px;color:var(--stone);">${r.c.phone}</span></td>
                        <td style="font-size:12px; color:var(--stone);">${r.ins ? r.ins.name : '—'}</td>
                        <td><strong>${r.cSessions.length}</strong></td>
                        <td style="color:var(--danger);">${r.cAbsent.length > 0 ? r.cAbsent.length : '—'}</td>
                        <td style="color:var(--sage-dark); font-weight:600;">${r.totalPaid > 0 ? r.totalPaid.toFixed(0)+' ₺' : '—'}</td>
                        <td style="color:var(--danger);">${r.totalDebt > 0 ? r.totalDebt.toFixed(0)+' ₺' : '—'}</td>
                        <td style="font-size:12px; color:var(--stone);">${r.lastSes ? new Date(r.lastSes.date).toLocaleDateString('tr-TR') : '—'}</td>
                    </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

// ── PDF BUTONLARI ─────────────────────────────────────────────
function generateMonthlyReportPDF() {
    const month = document.getElementById('reportMonthFilter')?.value;
    if (!month) { showNotification('Ay seçin', 'warning'); return; }
    const profile   = window._currentProfile || {};
    const bizName   = profile.businessName || 'İşletme';
    const today     = new Date().toLocaleDateString('tr-TR');
    const names     = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const [y, mo]   = month.split('-');
    const monthLabel = names[parseInt(mo)] + ' ' + y;

    const monthPayments = payments.filter(p => p.date?.startsWith(month));
    const monthSessions = sessions.filter(s => s.date?.startsWith(month) && s.status !== 'absent');
    const totalRev      = monthPayments.reduce((s,p) => s+p.amount, 0);
    const monthExpenses = (typeof expenses !== 'undefined' ? expenses : []).filter(e => e.date?.startsWith(month));
    const totalExp      = monthExpenses.reduce((s,e) => s+e.amount, 0);

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Aylık Rapor - ${monthLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#f5f3f0;color:#2d3340;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{background:white}.no-print{display:none!important}}
.page{max-width:860px;margin:24px auto;background:white;padding:48px 56px;box-shadow:0 4px 24px rgba(0,0,0,.08);border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
th{background:#2d3340;color:white;padding:9px 12px;text-align:left;font-weight:600;font-size:12px}
td{padding:8px 12px;border-bottom:1px solid #e8e2db}tr:nth-child(even) td{background:#f7f5f1}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e8e2db;border-radius:8px;overflow:hidden;margin:24px 0}
.kpi-item{background:white;padding:16px;text-align:center}
.kpi-label{font-size:11px;color:#6b7a86;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.kpi-value{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700}
h2{font-family:'Playfair Display',serif;font-size:1.2rem;margin:24px 0 12px;color:#2d3340}
</style></head><body><div class="page">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #2d3340;margin-bottom:8px">
        <div><div style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700">${bizName}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#6b7a86;text-transform:uppercase">Aylık Rapor</div><div style="font-size:1rem;font-weight:600;margin-top:2px">${monthLabel}</div><div style="font-size:12px;color:#6b7a86">${today}</div></div>
    </div>
    <div class="kpi">
        <div class="kpi-item"><div class="kpi-label">Gelir</div><div class="kpi-value" style="color:#5f8076">${totalRev.toFixed(0)} ₺</div></div>
        <div class="kpi-item"><div class="kpi-label">Gider</div><div class="kpi-value" style="color:#c0606a">${totalExp.toFixed(0)} ₺</div></div>
        <div class="kpi-item"><div class="kpi-label">Net Kâr</div><div class="kpi-value" style="color:${totalRev-totalExp>=0?'#5f8076':'#c0606a'}">${(totalRev-totalExp).toFixed(0)} ₺</div></div>
        <div class="kpi-item"><div class="kpi-label">Seans</div><div class="kpi-value">${monthSessions.length}</div></div>
    </div>
    <h2>💳 Ödemeler</h2>
    <table><thead><tr><th>Danışan</th><th>Paket</th><th>Tarih</th><th>Yöntem</th><th>Tutar</th></tr></thead><tbody>
    ${[...monthPayments].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p => {
        const c   = clients.find(c=>c.id===p.clientId);
        const pkg = packages.find(pk=>pk.id===p.packageId);
        return `<tr><td><strong>${c?.name||'—'}</strong></td><td style="color:#6b7a86">${pkg?.name||'—'}</td><td>${new Date(p.date).toLocaleDateString('tr-TR')}</td><td>${p.method||'—'}</td><td style="color:#5f8076;font-weight:600">${p.amount.toFixed(0)} ₺</td></tr>`;
    }).join('')}
    <tr style="font-weight:700;background:#f0ede6"><td colspan="4">TOPLAM</td><td style="color:#5f8076">${totalRev.toFixed(0)} ₺</td></tr>
    </tbody></table>
    <h2>💸 Giderler</h2>
    ${monthExpenses.length ? `<table><thead><tr><th>Açıklama</th><th>Kategori</th><th>Tarih</th><th>Tutar</th></tr></thead><tbody>
    ${monthExpenses.map(e => `<tr><td>${e.desc}</td><td style="color:#6b7a86">${e.category||'—'}</td><td>${new Date(e.date).toLocaleDateString('tr-TR')}</td><td style="color:#c0606a;font-weight:600">${e.amount.toFixed(0)} ₺</td></tr>`).join('')}
    <tr style="font-weight:700;background:#f0ede6"><td colspan="3">TOPLAM</td><td style="color:#c0606a">${totalExp.toFixed(0)} ₺</td></tr>
    </tbody></table>` : '<div style="padding:20px;color:#6b7a86;text-align:center">Bu ay gider kaydı yok</div>'}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e8e2db;font-size:11px;color:#9aa5ad;text-align:center">${bizName} · ${today}</div>
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f0ede8;border-top:1px solid #ddd8d2">
    <button onclick="window.print()" style="padding:11px 28px;background:#5f8076;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px">🖨️ PDF Kaydet</button>
    <button onclick="window.close()" style="padding:11px 20px;background:#e8e2db;color:#2d3340;border:none;border-radius:8px;font-size:14px;cursor:pointer">Kapat</button>
</div>
</body></html>`;

    const win = window.open('','_blank','width=900,height=700');
    if (!win) { showNotification('Pop-up engellendi', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 900);
}

function generateYearlyReportPDF() {
    const year    = document.getElementById('reportYearFilter')?.value;
    if (!year) { showNotification('Yıl seçin', 'warning'); return; }
    const profile = window._currentProfile || {};
    const bizName = profile.businessName || 'İşletme';
    const today   = new Date().toLocaleDateString('tr-TR');
    const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

    const yearPayments = payments.filter(p => p.date?.startsWith(year));
    const yearSessions = sessions.filter(s => s.date?.startsWith(year) && s.status !== 'absent');
    const totalRev     = yearPayments.reduce((s,p) => s+p.amount, 0);
    const yearExp      = (typeof expenses !== 'undefined' ? expenses : []).filter(e => e.date?.startsWith(year));
    const totalExp     = yearExp.reduce((s,e) => s+e.amount, 0);

    const monthlyData = Array.from({length:12}, (_,i) => {
        const m   = year + '-' + String(i+1).padStart(2,'0');
        const rev = yearPayments.filter(p => p.date?.startsWith(m)).reduce((s,p) => s+p.amount, 0);
        const exp = yearExp.filter(e => e.date?.startsWith(m)).reduce((s,e) => s+e.amount, 0);
        const ses = yearSessions.filter(s => s.date?.startsWith(m)).length;
        return { month: monthNames[i], rev, exp, net: rev-exp, ses };
    });

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Yıllık Rapor - ${year}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#f5f3f0;color:#2d3340;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{background:white}.no-print{display:none!important}}
.page{max-width:860px;margin:24px auto;background:white;padding:48px 56px;box-shadow:0 4px 24px rgba(0,0,0,.08);border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#2d3340;color:white;padding:9px 12px;text-align:left;font-weight:600;font-size:12px}
td{padding:8px 12px;border-bottom:1px solid #e8e2db}tr:nth-child(even) td{background:#f7f5f1}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e8e2db;border-radius:8px;overflow:hidden;margin:24px 0}
.kpi-item{background:white;padding:16px;text-align:center}
.kpi-label{font-size:11px;color:#6b7a86;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.kpi-value{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700}
</style></head><body><div class="page">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #2d3340;margin-bottom:8px">
        <div><div style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700">${bizName}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#6b7a86;text-transform:uppercase">Yıllık Rapor</div><div style="font-size:1.5rem;font-weight:700;margin-top:2px">${year}</div><div style="font-size:12px;color:#6b7a86">${today}</div></div>
    </div>
    <div class="kpi">
        <div class="kpi-item"><div class="kpi-label">Yıl Geliri</div><div class="kpi-value" style="color:#5f8076">${totalRev.toFixed(0)} ₺</div></div>
        <div class="kpi-item"><div class="kpi-label">Yıl Gideri</div><div class="kpi-value" style="color:#c0606a">${totalExp.toFixed(0)} ₺</div></div>
        <div class="kpi-item"><div class="kpi-label">Net Kâr</div><div class="kpi-value" style="color:${totalRev-totalExp>=0?'#5f8076':'#c0606a'}">${(totalRev-totalExp).toFixed(0)} ₺</div></div>
        <div class="kpi-item"><div class="kpi-label">Toplam Seans</div><div class="kpi-value">${yearSessions.length}</div></div>
    </div>
    <table><thead><tr><th>Ay</th><th>Gelir</th><th>Gider</th><th>Net Kâr</th><th>Seans</th></tr></thead>
    <tbody>
    ${monthlyData.map(d => `<tr>
        <td><strong>${d.month}</strong></td>
        <td style="color:#5f8076">${d.rev>0?d.rev.toFixed(0)+' ₺':'—'}</td>
        <td style="color:#c0606a">${d.exp>0?d.exp.toFixed(0)+' ₺':'—'}</td>
        <td style="font-weight:600;color:${d.net>=0?'#5f8076':'#c0606a'}">${d.rev>0||d.exp>0?d.net.toFixed(0)+' ₺':'—'}</td>
        <td>${d.ses>0?d.ses:'—'}</td>
    </tr>`).join('')}
    <tr style="font-weight:700;background:#f0ede6"><td>TOPLAM</td><td style="color:#5f8076">${totalRev.toFixed(0)} ₺</td><td style="color:#c0606a">${totalExp.toFixed(0)} ₺</td><td style="color:#5f8076">${(totalRev-totalExp).toFixed(0)} ₺</td><td>${yearSessions.length}</td></tr>
    </tbody></table>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e8e2db;font-size:11px;color:#9aa5ad;text-align:center">${bizName} · ${today}</div>
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f0ede8;border-top:1px solid #ddd8d2">
    <button onclick="window.print()" style="padding:11px 28px;background:#5f8076;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px">🖨️ PDF Kaydet</button>
    <button onclick="window.close()" style="padding:11px 20px;background:#e8e2db;color:#2d3340;border:none;border-radius:8px;font-size:14px;cursor:pointer">Kapat</button>
</div></body></html>`;

    const win = window.open('','_blank','width=900,height=700');
    if (!win) { showNotification('Pop-up engellendi', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 900);
}

function generateClientReportPDF() {
    const profile = window._currentProfile || {};
    const bizName = profile.businessName || 'İşletme';
    const today   = new Date().toLocaleDateString('tr-TR');

    const rows = clients.map(c => {
        const cSessions = sessions.filter(s => s.clientId === c.id && s.status !== 'absent');
        const cAbsent   = sessions.filter(s => s.clientId === c.id && s.status === 'absent');
        const cPackages = packages.filter(p => p.clientId === c.id);
        const cPayments = payments.filter(p => p.clientId === c.id);
        const totalPaid = cPayments.reduce((s,p) => s+p.amount, 0);
        const totalDebt = cPackages.reduce((s,p) => s+Math.max(0,(p.price||0)-(p.paidAmount||0)), 0);
        const ins       = cPackages[0]?.instructorId ? instructors.find(i => i.id === cPackages[0].instructorId) : null;
        return { c, sessions: cSessions.length, absent: cAbsent.length, totalPaid, totalDebt, ins };
    });

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Danışan Raporu</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#f5f3f0;color:#2d3340;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{background:white}.no-print{display:none!important}}
.page{max-width:860px;margin:24px auto;background:white;padding:48px 56px;box-shadow:0 4px 24px rgba(0,0,0,.08);border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#2d3340;color:white;padding:8px 10px;text-align:left;font-weight:600;font-size:11px}
td{padding:7px 10px;border-bottom:1px solid #e8e2db}tr:nth-child(even) td{background:#f7f5f1}
</style></head><body><div class="page">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #2d3340;margin-bottom:20px">
        <div><div style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:700">${bizName}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#6b7a86;text-transform:uppercase">Danışan Raporu</div><div style="font-size:12px;color:#6b7a86;margin-top:2px">${today}</div></div>
    </div>
    <table><thead><tr><th>Danışan</th><th>Telefon</th><th>Eğitmen</th><th>Seans</th><th>Devamsız</th><th>Tahsilat</th><th>Borç</th></tr></thead>
    <tbody>
    ${rows.map(r => `<tr>
        <td><strong>${r.c.name}</strong></td>
        <td style="color:#6b7a86">${r.c.phone}</td>
        <td style="color:#6b7a86">${r.ins ? r.ins.name : '—'}</td>
        <td>${r.sessions}</td>
        <td style="color:${r.absent>0?'#c0606a':'#6b7a86'}">${r.absent > 0 ? r.absent : '—'}</td>
        <td style="color:#5f8076;font-weight:600">${r.totalPaid > 0 ? r.totalPaid.toFixed(0)+' ₺' : '—'}</td>
        <td style="color:${r.totalDebt>0?'#c0606a':'#6b7a86'}">${r.totalDebt > 0 ? r.totalDebt.toFixed(0)+' ₺' : '—'}</td>
    </tr>`).join('')}
    </tbody></table>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e8e2db;font-size:11px;color:#9aa5ad;text-align:center">${bizName} · ${today} · Toplam ${clients.length} danışan</div>
</div>
<div class="no-print" style="text-align:center;padding:16px;background:#f0ede8;border-top:1px solid #ddd8d2">
    <button onclick="window.print()" style="padding:11px 28px;background:#5f8076;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px">🖨️ PDF Kaydet</button>
    <button onclick="window.close()" style="padding:11px 20px;background:#e8e2db;color:#2d3340;border:none;border-radius:8px;font-size:14px;cursor:pointer">Kapat</button>
</div></body></html>`;

    const win = window.open('','_blank','width=900,height=700');
    if (!win) { showNotification('Pop-up engellendi', 'warning'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 900);
}

window.switchReportTab         = switchReportTab;
window.initMonthFilter         = initMonthFilter;
window.renderMonthlyReport     = renderMonthlyReport;
window.initYearFilter          = initYearFilter;
window.renderYearlyReport      = renderYearlyReport;
window.renderClientReport      = renderClientReport;
window.generateMonthlyReportPDF = generateMonthlyReportPDF;
window.generateYearlyReportPDF  = generateYearlyReportPDF;
window.generateClientReportPDF  = generateClientReportPDF;
