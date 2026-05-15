// ============================================================
// notifications.js — WhatsApp + Push + Hatırlatıcılar
// ============================================================

// ─── TELEFON FORMATI ────────────────────────────────────────
function formatPhone(raw) {
    var phone = (raw || '').replace(/\D/g, '');
    if (phone.startsWith('90'))  return phone;
    if (phone.startsWith('0'))   return '90' + phone.slice(1);
    return '90' + phone;
}

function openWA(phone, message) {
    var url = 'https://wa.me/' + formatPhone(phone) + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank');
}

function bizInfo() {
    var p = window._currentProfile || {};
    return {
        name:    p.businessName || 'Stüdyomuz',
        phone:   p.phone   || '',
        address: p.address || '',
    };
}

// ─── MESAJ ŞABLONLARI ───────────────────────────────────────
var WA_TEMPLATES = {

    session_reminder: {
        label: 'Yarınki Seans Hatırlatması',
        icon:  '📅',
        build: function(client, extra) {
            var session = (extra && extra.session) || {};
            var dateStr = session.date ? new Date(session.date).toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long'}) : '';
            var biz = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                '*' + biz.name + '* sizi yar\u0131nki sean\u015f\u0131n\u0131z i\u00e7in hat\u0131rlatmak istedi.\n\n' +
                (dateStr ? '\uD83D\uDCC5 *' + dateStr + '*\n' : '') +
                (session.time ? '\uD83D\uDD50 Saat: *' + session.time + '*\n' : '') +
                (session.type ? '\uD83D\uDCAA ' + session.type + '\n' : '') +
                '\nGelememeniz durumunda l\u00fctfen \u00f6nceden bildirin.\n' +
                'G\u00f6r\u00fc\u015fmek \u00fczere! \uD83C\uDF3F';
        }
    },

    session_today: {
        label: 'Bugünkü Seans Hatırlatması',
        icon:  '⏰',
        build: function(client, extra) {
            var session = (extra && extra.session) || {};
            var biz = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                'Bug\u00fcn saat *' + (session.time || '') + '* da *' + biz.name + '* da ' + (session.type || 'sean\u015f\u0131n\u0131z') + ' var.\n\n' +
                'Sizi bekliyoruz \uD83C\uDF3F';
        }
    },

    package_low: {
        label: 'Paket Bitiyor Uyarısı',
        icon:  '📦',
        build: function(client, extra) {
            var pkg = (extra && extra.pkg) || {};
            var biz = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                '*' + (pkg.name || 'Paketiniz') + '* paketinizde yaln\u0131zca *' + (pkg.remainingSessions || '?') + ' seans* kald\u0131.\n\n' +
                'Sean\u015flar\u0131n\u0131z\u0131n kesintisiz devam etmesi i\u00e7in yeni paket olu\u015fturmay\u0131 unutmay\u0131n.\n\n' +
                (biz.phone ? '\uD83D\uDCDE ' + biz.phone + '\n' : '') +
                '— ' + biz.name + ' \uD83C\uDF3F';
        }
    },

    package_expired: {
        label: 'Paket Bitti',
        icon:  '🔴',
        build: function(client, extra) {
            var pkg = (extra && extra.pkg) || {};
            var biz = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                '*' + (pkg.name || 'Paketiniz') + '* paketiniz tamamland\u0131. \uD83C\uDF89\n\n' +
                'Devam etmek i\u00e7in yeni bir paket olu\u015fturabilirsiniz.\n' +
                'Fiyat listemiz i\u00e7in l\u00fctfen bize ula\u015f\u0131n.\n\n' +
                (biz.phone ? '\uD83D\uDCDE ' + biz.phone + '\n' : '') +
                '— ' + biz.name + ' \uD83C\uDF3F';
        }
    },

    payment_overdue: {
        label: 'Gecikmiş Ödeme',
        icon:  '💸',
        build: function(client, extra) {
            var pkg  = (extra && extra.pkg) || {};
            var debt = ((pkg.price || 0) - (pkg.paidAmount || 0)).toFixed(0);
            var biz  = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                '*' + (pkg.name || 'Paketinize') + '* ait *' + debt + ' \u20BA* \u00f6deme hen\u00fcz ger\u00e7ekle\u015fmedi.\n\n' +
                '\u00d6demenizi ger\u00e7ekle\u015ftirmek i\u00e7in bizimle ileti\u015fime ge\u00e7ebilirsiniz.\n\n' +
                (biz.phone ? '\uD83D\uDCDE ' + biz.phone + '\n' : '') +
                '— ' + biz.name + ' \uD83C\uDF3F';
        }
    },

    payment_received: {
        label: 'Ödeme Alındı Teşekkür',
        icon:  '✅',
        build: function(client, extra) {
            var pkg    = (extra && extra.pkg) || {};
            var amount = (extra && extra.amount) || '';
            var biz    = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                '*' + amount + ' \u20BA* tutar\u0131ndaki \u00f6demeniz al\u0131nm\u0131\u015ft\u0131r. Te\u015fekk\u00fcr ederiz \uD83D\uDE4F\n\n' +
                (pkg.name ? '\uD83D\uDCE6 Paket: ' + pkg.name + '\n' : '') +
                '— ' + biz.name + ' \uD83C\uDF3F';
        }
    },

    welcome: {
        label: 'Hoş Geldiniz Mesajı',
        icon:  '🎉',
        build: function(client, extra) {
            var biz = bizInfo();
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                '*' + biz.name + '* a ho\u015f geldiniz! \uD83C\uDF3F\n\n' +
                'Sa\u011fl\u0131k yolculu\u011funuzda yan\u0131n\u0131zda olmaktan mutluluk duyuyoruz.\n' +
                'Herhangi bir sorunuz olursa bize ula\u015fmaktan \u00e7ekinmeyin.\n\n' +
                (biz.phone   ? '\uD83D\uDCDE ' + biz.phone   + '\n' : '') +
                (biz.address ? '\uD83D\uDCCD ' + biz.address + '\n' : '') +
                'G\u00f6r\u00fc\u015fmek \u00fczere! \uD83C\uDF3F';
        }
    },

    absence_reminder: {
        label: 'Gelmedi — Sonraki Seans Bilgisi',
        icon:  '🚫',
        build: function(client, extra) {
            var nextSession = (extra && extra.nextSession) || null;
            var biz = bizInfo();
            var nextStr = nextSession
                ? new Date(nextSession.date).toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long'})
                : null;
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n' +
                'Bug\u00fcnk\u00fc sean\u015f\u0131n\u0131zda sizi g\u00f6remedik. Umar\u0131z iyisinizdir \uD83D\uDE4F\n\n' +
                (nextStr ? '\uD83D\uDCC5 Bir sonraki sean\u015f\u0131n\u0131z: *' + nextStr + ' ' + nextSession.time + '*\n\n' : '') +
                'Herhangi bir de\u011fi\u015fiklik i\u00e7in l\u00fctfen bize bildirin.\n' +
                '— ' + biz.name + ' \uD83C\uDF3F';
        }
    },

    birthday: {
        label: 'Doğum Günü Kutlaması',
        icon:  '🎂',
        build: function(client, extra) {
            var biz = bizInfo();
            return '\uD83C\uDF82 \u0130yi ki do\u011fdunuz ' + client.name + '!\n\n' +
                '*' + biz.name + '* ailesi olarak do\u011fum g\u00fcn\u00fcn\u00fcz\u00fc en i\u00e7ten dileklerimizle kutlar\u0131z \uD83C\uDF38\n\n' +
                'Sa\u011fl\u0131kl\u0131, mutlu ve enerjik bir y\u0131l diliyoruz \uD83D\uDC90\n' +
                '— ' + biz.name + ' \uD83C\uDF3F';
        }
    },

    custom: {
        label: 'Özel Mesaj',
        icon:  '✏️',
        build: function(client, extra) {
            return 'Merhaba ' + client.name + ' \uD83D\uDC4B\n\n';
        }
    }
};

// ─── WA COMPOSER MODAL ──────────────────────────────────────
function openWAComposer(clientId, templateKey, extra) {
    templateKey = templateKey || 'session_reminder';
    extra = extra || {};

    var allClients = (window.clientsData) || (typeof clients !== 'undefined' ? clients : []);
    var client = allClients.find(function(c) { return c.id === clientId; });
    if (!client) { console.warn('openWAComposer: client not found', clientId); return; }

    var existing = document.getElementById('waComposerModal');
    if (existing) existing.remove();

    window._waComposerClient = client;
    window._waComposerExtra  = extra;

    var tpl = WA_TEMPLATES[templateKey] || WA_TEMPLATES.session_reminder;
    var initialMsg = tpl.build(client, extra);

    // Build template buttons
    var tplHTML = '';
    Object.keys(WA_TEMPLATES).forEach(function(key) {
        var t = WA_TEMPLATES[key];
        var active = key === templateKey;
        tplHTML += '<button type="button" onclick="selectWATemplate(\'' + key + '\')"' +
            ' id="tplBtn_' + key + '"' +
            ' style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;' +
            'font-family:sans-serif;font-weight:500;text-align:left;transition:all .15s;' +
            'border:1.5px solid ' + (active ? 'var(--sage-dark)' : 'var(--border)') + ';' +
            'background:' + (active ? 'var(--sage-light)' : 'var(--surface-2)') + ';' +
            'color:' + (active ? 'var(--sage-dark)' : 'var(--ink)') + ';">' +
            t.icon + ' ' + t.label + '</button>';
    });

    var modal = document.createElement('div');
    modal.id = 'waComposerModal';
    modal.className = 'modal active';

    var inner = document.createElement('div');
    inner.className = 'modal-content';
    inner.style.maxWidth = '520px';
    inner.innerHTML =
        '<div class="modal-header">' +
            '<h3>&#x1F4AC; WhatsApp Mesaj</h3>' +
            '<button class="close-btn" onclick="document.getElementById(\'waComposerModal\').remove()">&#x2715;</button>' +
        '</div>' +
        '<div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface-2);border-radius:var(--r-md);">' +
                '<div style="width:38px;height:38px;background:linear-gradient(135deg,var(--sage-light),var(--lav-light));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;">&#x1F464;</div>' +
                '<div><div style="font-weight:600;font-size:14px;">' + client.name + '</div>' +
                '<div style="font-size:12px;color:var(--stone);">&#x1F4F1; ' + client.phone + '</div></div>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:0;">' +
                '<label>Mesaj Sablonu</label>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">' + tplHTML + '</div>' +
            '</div>' +
            '<div class="form-group" style="margin-bottom:0;">' +
                '<label>Mesaj (duzenleyebilirsiniz)</label>' +
                '<textarea id="waMessageText" rows="8" style="font-size:13px;line-height:1.6;resize:vertical;" oninput="updateWACharCount()">' + initialMsg + '</textarea>' +
                '<div style="display:flex;justify-content:space-between;margin-top:4px;">' +
                    '<span style="font-size:11px;color:var(--stone);">*kalin* _italik_ formatini destekler</span>' +
                    '<span id="waCharCount" style="font-size:11px;color:var(--stone);">' + initialMsg.length + ' karakter</span>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
            '<button class="btn btn-secondary" onclick="document.getElementById(\'waComposerModal\').remove()">Iptal</button>' +
            '<button class="btn btn-success" onclick="sendFromComposer()">&#x1F4AC; WhatsApp Gonder</button>' +
        '</div>';

    modal.appendChild(inner);
    document.body.appendChild(modal);
}

function selectWATemplate(key) {
    var client = window._waComposerClient;
    var extra  = window._waComposerExtra || {};
    var tpl    = WA_TEMPLATES[key];
    if (!tpl || !client) return;
    var msg = tpl.build(client, extra);
    var ta = document.getElementById('waMessageText');
    if (ta) { ta.value = msg; updateWACharCount(); }
    Object.keys(WA_TEMPLATES).forEach(function(k) {
        var btn = document.getElementById('tplBtn_' + k);
        if (!btn) return;
        var active = k === key;
        btn.style.borderColor = active ? 'var(--sage-dark)' : 'var(--border)';
        btn.style.background  = active ? 'var(--sage-light)' : 'var(--surface-2)';
        btn.style.color       = active ? 'var(--sage-dark)' : 'var(--ink)';
    });
}

function updateWACharCount() {
    var el = document.getElementById('waMessageText');
    var cc = document.getElementById('waCharCount');
    if (el && cc) cc.textContent = el.value.length + ' karakter';
}

function sendFromComposer() {
    var client = window._waComposerClient;
    var msgEl  = document.getElementById('waMessageText');
    if (!client || !msgEl || !msgEl.value.trim()) return;
    openWA(client.phone, msgEl.value);
    var modal = document.getElementById('waComposerModal');
    if (modal) modal.remove();
}

// ─── TEMEL WA FONKSİYONLARI ────────────────────────────────
function sendWhatsAppReminder(client, session) {
    openWAComposer(client.id || client, 'session_reminder', { session: session });
}

function sendWhatsAppPaymentReminder(client, pkg) {
    openWAComposer(client.id || client, 'payment_overdue', { pkg: pkg });
}

function sendWhatsAppBirthday(client) {
    openWAComposer(client.id || client, 'birthday', {});
}

function sendWhatsAppWelcome(client) {
    openWAComposer(client.id || client, 'welcome', {});
}

function sendWhatsAppPackageLow(client, pkg) {
    openWAComposer(client.id || client, 'package_low', { pkg: pkg });
}

function sendWhatsAppPaymentReceived(client, pkg, amount) {
    openWAComposer(client.id || client, 'payment_received', { pkg: pkg, amount: amount });
}

// ─── TOPLU WA KUYRUK SİSTEMİ ────────────────────────────────
var _waQueue   = [];
var _waModal   = null;

function sendAllWhatsApp(items) {
    if (!items || !items.length) {
        if (typeof showNotification === 'function') showNotification('Gonderilecek kisi yok', 'warning');
        return;
    }
    // items: [{client, session}] veya clientId dizisi
    if (typeof items[0] === 'string') {
        var allClients  = window.clientsData  || (typeof clients  !== 'undefined' ? clients  : []);
        var allSessions = window.sessionsData || (typeof sessions !== 'undefined' ? sessions : []);
        items = items.map(function(id) {
            var c = allClients.find(function(x) { return x.id === id; });
            var s = allSessions.find(function(x) { return x.clientId === id; });
            return (c && s) ? { client: c, session: s } : null;
        }).filter(Boolean);
    }
    _waQueue = items.slice();
    _waQueue.forEach(function(x) { x._sent = false; });
    showWaQueueModal();
}

function showWaQueueModal() {
    if (_waModal) _waModal.remove();
    var total = _waQueue.length;

    var itemsHTML = _waQueue.map(function(item, i) {
        return '<div id="waItem_' + i + '" style="display:flex;align-items:center;gap:10px;padding:9px 12px;' +
            'background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--border-soft);">' +
            '<span id="waIcon_' + i + '" style="font-size:16px;flex-shrink:0;">&#x23F3;</span>' +
            '<div style="flex:1;">' +
                '<div style="font-size:13px;font-weight:600;">' + item.client.name + '</div>' +
                '<div style="font-size:11px;color:var(--stone);">' +
                    (item.session ? item.session.time + ' — ' + item.session.type : 'Odeme hatirlatmasi') +
                '</div>' +
            '</div>' +
            '</div>';
    }).join('');

    _waModal = document.createElement('div');
    _waModal.id = 'waQueueModal';
    _waModal.className = 'modal active';
    _waModal.innerHTML =
        '<div class="modal-content" style="max-width:420px;">' +
            '<div class="modal-header">' +
                '<h3>&#x1F4AC; Toplu WhatsApp</h3>' +
                '<button class="close-btn" onclick="cancelWaQueue()">&#x2715;</button>' +
            '</div>' +
            '<div class="modal-body" style="text-align:center;padding:24px 20px;">' +
                '<div style="font-size:40px;margin-bottom:10px;">&#x1F4AC;</div>' +
                '<p style="font-weight:600;color:var(--ink);margin-bottom:4px;">' + total + ' kisiye mesaj</p>' +
                '<p style="font-size:13px;color:var(--stone);margin-bottom:16px;">Her WhatsApp acildiginda Gonder e basin, geri donun.</p>' +
                '<div style="display:flex;flex-direction:column;gap:6px;text-align:left;max-height:240px;overflow-y:auto;">' +
                    itemsHTML +
                '</div>' +
                '<div style="margin-top:14px;">' +
                    '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--stone);margin-bottom:6px;">' +
                        '<span id="waProgressLabel">Hazir</span>' +
                        '<span id="waProgressNum">0 / ' + total + '</span>' +
                    '</div>' +
                    '<div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;">' +
                        '<div id="waProgressBar" style="height:100%;width:0%;background:var(--sage-dark);border-radius:99px;transition:width .4s;"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button id="waNextBtn" class="btn btn-success w-full" onclick="sendNextWa()" style="font-size:15px;padding:13px;">' +
                    '&#x1F4AC; Gondermeye Basla' +
                '</button>' +
                '<button class="btn btn-secondary w-full" onclick="cancelWaQueue()">Iptal</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(_waModal);
}

function sendNextWa() {
    var pending = _waQueue.filter(function(x) { return !x._sent; });
    var total   = _waQueue.length;
    if (!pending.length) {
        var btn = document.getElementById('waNextBtn');
        if (btn) { btn.textContent = 'Tamamlandi'; btn.disabled = true; }
        if (typeof showNotification === 'function') showNotification('Tum mesajlar gonderildi', 'success');
        return;
    }
    var item  = pending[0];
    var index = _waQueue.indexOf(item);
    item._sent = true;

    var icon = document.getElementById('waIcon_' + index);
    var row  = document.getElementById('waItem_'  + index);
    if (icon) icon.textContent = '📤';
    if (row)  row.style.background = 'rgba(143,173,161,.1)';

    // WhatsApp'ı aç
    if (item._isDebt && item._pkg) {
        openWA(item.client.phone, WA_TEMPLATES.payment_overdue.build(item.client, { pkg: item._pkg }));
    } else if (item.session) {
        openWA(item.client.phone, WA_TEMPLATES.session_reminder.build(item.client, { session: item.session }));
    }

    setTimeout(function() {
        if (icon) icon.textContent = '✅';
        if (row)  row.style.borderColor = 'var(--sage-light)';
    }, 800);

    var done = _waQueue.filter(function(x) { return x._sent; }).length;
    var pct  = Math.round(done / total * 100);
    var bar  = document.getElementById('waProgressBar');
    var lbl  = document.getElementById('waProgressLabel');
    var num  = document.getElementById('waProgressNum');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = done + '/' + total + ' gonderildi';
    if (num) num.textContent = done + ' / ' + total;

    var btn = document.getElementById('waNextBtn');
    if (btn) {
        if (pending.length === 1) {
            btn.textContent = 'Tamamlandi';
            btn.onclick = cancelWaQueue;
        } else {
            btn.textContent = 'Sonraki: ' + pending[1].client.name;
        }
    }
}

function cancelWaQueue() {
    if (_waModal) { _waModal.remove(); _waModal = null; }
    _waQueue = [];
}

// ─── BİLDİRİM PANELİ ────────────────────────────────────────
function getTomorrowSessions(sessions, clients) {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tStr = tomorrow.getFullYear() + '-' +
        String(tomorrow.getMonth()+1).padStart(2,'0') + '-' +
        String(tomorrow.getDate()).padStart(2,'0');
    return sessions
        .filter(function(s) { return s.date === tStr; })
        .map(function(s) { return { session: s, client: clients.find(function(c) { return c.id === s.clientId; }) }; })
        .filter(function(x) { return x.client; });
}

function checkBirthdays(clients) {
    var today = new Date();
    var todayMD = String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    return clients.filter(function(c) {
        return c.birthdate && c.birthdate.slice(5) === todayMD;
    });
}

function openNotificationsPanel(sessions, clients, packages) {
    var tomorrow = getTomorrowSessions(sessions, clients);
    var bdays    = checkBirthdays(clients);
    var debts    = packages
        .map(function(p) {
            return { pkg: p, client: clients.find(function(c) { return c.id === p.clientId; }), debt: (p.price||0)-(p.paidAmount||0) };
        })
        .filter(function(x) { return x.debt > 0 && x.client; });

    var existing = document.getElementById('notifPanelModal');
    if (existing) existing.remove();

    window._bulkList    = tomorrow;
    window._debtMap     = {};
    window._tomorrowMap = {};
    window._birthdayMap = {};
    tomorrow.forEach(function(x, i) { window._tomorrowMap[i] = x; });
    debts.forEach(function(x, i)    { window._debtMap[i]     = x; });
    bdays.forEach(function(c, i)    { window._birthdayMap[i] = c; });

    var tomorrowHTML = '';
    if (tomorrow.length) {
        var rows = tomorrow.map(function(item, i) {
            return '<div class="session-item">' +
                '<div><strong>' + item.client.name + '</strong>' +
                ' <span style="font-size:12px;color:var(--stone);">' + item.session.time + ' — ' + item.session.type + '</span></div>' +
                '<div style="display:flex;gap:6px;">' +
                '<button class="btn btn-success btn-xs" onclick="window._sendTomorrowReminder(' + i + ')">&#x1F4AC;</button>' +
                (item.client.email ? '<button class="btn btn-lavender btn-xs" onclick="window._sendTomorrowEmail(' + i + ')">&#x1F4E7;</button>' : '') +
                '</div></div>';
        }).join('');
        tomorrowHTML = '<div>' +
            '<h3 style="margin-bottom:12px;font-size:1rem;">&#x1F4C5; Yarinki Seanslar (' + tomorrow.length + ')</h3>' +
            rows +
            '<button class="btn btn-success btn-sm" style="margin-top:10px;" onclick="sendAllWhatsApp(window._bulkList)">&#x1F4AC; Tumune Sirasyla Gonder</button>' +
            '</div>';
    } else {
        tomorrowHTML = '<div style="padding:16px;text-align:center;color:var(--stone);">&#x2713; Yarin icin seans yok</div>';
    }

    var bdayHTML = '';
    if (bdays.length) {
        bdayHTML = '<div><h3 style="margin-bottom:12px;font-size:1rem;">&#x1F382; Bugun Dogum Gunu (' + bdays.length + ')</h3>' +
            bdays.map(function(c, bi) {
                return '<div class="session-item">' +
                    '<div><strong>' + c.name + '</strong> <span style="font-size:12px;color:var(--stone);">' + c.phone + '</span></div>' +
                    '<button class="btn btn-success btn-xs" onclick="window._sendBirthday(' + bi + ')">&#x1F382; Tebrik Et</button>' +
                    '</div>';
            }).join('') + '</div>';
    }

    var debtHTML = '';
    if (debts.length) {
        debtHTML = '<div>' +
            '<h3 style="margin-bottom:12px;font-size:1rem;">&#x26A0;&#xFE0F; Bekleyen Odemeler (' + debts.length + ')</h3>' +
            debts.map(function(x, i) {
                return '<div class="session-item">' +
                    '<div><strong>' + x.client.name + '</strong> <span style="font-size:12px;color:var(--stone);">' + x.pkg.name + '</span></div>' +
                    '<span style="color:var(--danger);font-weight:700;">' + x.debt.toFixed(0) + ' &#x20BA;</span>' +
                    '<button class="btn btn-success btn-xs" onclick="window._sendDebtReminder(' + i + ')">&#x1F4AC; Hatırlat</button>' +
                    '</div>';
            }).join('') +
            '<button class="btn btn-success btn-sm" style="margin-top:10px;width:100%;" onclick="window._sendAllDebtReminders()">&#x1F4AC; Tumune Odeme Hatirlatmasi</button>' +
            '</div>';
    }

    var modal = document.createElement('div');
    modal.id = 'notifPanelModal';
    modal.className = 'modal active';
    modal.innerHTML =
        '<div class="modal-content large">' +
            '<div class="modal-header">' +
                '<h3>&#x1F514; Bildirimler</h3>' +
                '<button class="close-btn" onclick="document.getElementById(\'notifPanelModal\').remove()">&#x2715;</button>' +
            '</div>' +
            '<div class="modal-body" style="display:flex;flex-direction:column;gap:20px;">' +
                tomorrowHTML + bdayHTML + debtHTML +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="btn btn-primary" onclick="requestPushPermission()">&#x1F514; Push Bildirim Ac</button>' +
                '<button class="btn btn-secondary" onclick="document.getElementById(\'notifPanelModal\').remove()">Kapat</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
}

// ─── INDEX TABANLI YARDIMCILAR ───────────────────────────────
window._sendDebtReminder = function(i) {
    var x = (window._debtMap || {})[i];
    if (!x) return;
    openWAComposer(x.client.id, 'payment_overdue', { pkg: x.pkg });
};

window._sendAllDebtReminders = function() {
    var map   = window._debtMap || {};
    var items = Object.values(map).map(function(x) {
        return { client: x.client, session: null, _isDebt: true, _pkg: x.pkg };
    });
    if (!items.length) {
        if (typeof showNotification === 'function') showNotification('Bekleyen odeme yok', 'warning');
        return;
    }
    _waQueue = items;
    _waQueue.forEach(function(x) { x._sent = false; });
    showWaQueueModal();
};

window._sendTomorrowReminder = function(i) {
    var x = (window._tomorrowMap || {})[i];
    if (!x) return;
    openWAComposer(x.client.id, 'session_reminder', { session: x.session });
};

window._sendTomorrowEmail = function(i) {
    var x = (window._tomorrowMap || {})[i];
    if (!x) return;
    if (typeof sendEmailReminder === 'function') sendEmailReminder(x.client, x.session);
};

window._sendBulkItem = function(i) {
    var x = (window._bulkMap || {})[i];
    if (!x) return;
    openWAComposer(x.client.id, 'session_reminder', { session: x.session });
};

window._sendBulkEmail = function(i) {
    var x = (window._bulkMap || {})[i];
    if (!x) return;
    if (typeof sendEmailReminder === 'function') sendEmailReminder(x.client, x.session);
};

window._sendBirthday = function(i) {
    var c = (window._birthdayMap || {})[i];
    if (!c) return;
    openWAComposer(c.id, 'birthday', {});
};

// ─── PUSH BİLDİRİMLERİ ──────────────────────────────────────
function requestPushPermission() {
    if (!('Notification' in window)) {
        if (typeof showNotification === 'function') showNotification('Bu tarayici bildirim desteklemiyor', 'warning');
        return Promise.resolve(false);
    }
    if (Notification.permission === 'granted') return Promise.resolve(true);
    return Notification.requestPermission().then(function(p) { return p === 'granted'; });
}

function sendPushNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body: body });
}

// ─── DOĞUM GÜNÜ KONTROLÜ ────────────────────────────────────
function showBirthdayAlert(clients) {
    var bdays = checkBirthdays(clients);
    if (!bdays.length) return;
    if (typeof showNotification === 'function') {
        if (bdays.length === 1) {
            showNotification('Bugun ' + bdays[0].name + ' adli danisaninizin dogum gunu!', 'success');
        } else {
            showNotification('Bugun ' + bdays.length + ' danisaninizin dogum gunu var!', 'success');
        }
    }
}

// ─── SABAH HATIRLATICI ───────────────────────────────────────
function checkMorningReminder(sessions, clients) {
    var key = 'waReminderShown_' + new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(key)) return;

    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tStr = tomorrow.getFullYear() + '-' +
        String(tomorrow.getMonth()+1).padStart(2,'0') + '-' +
        String(tomorrow.getDate()).padStart(2,'0');

    var list = (sessions || [])
        .filter(function(s) { return s.date === tStr; })
        .map(function(s) {
            return { session: s, client: (clients || []).find(function(c) { return c.id === s.clientId; }) };
        })
        .filter(function(x) { return x.client; });

    if (!list.length) return;
    sessionStorage.setItem(key, '1');
    window._morningList = list;

    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
        'background:var(--surface);border:1.5px solid var(--sage-light);border-radius:var(--r-lg);' +
        'box-shadow:var(--shadow-lg);padding:16px 20px;z-index:9999;min-width:300px;max-width:380px;';

    var btnSend = document.createElement('button');
    btnSend.className = 'btn btn-success btn-sm';
    btnSend.style.flex = '1';
    btnSend.textContent = 'Toplu Hatırlat';
    btnSend.onclick = function() {
        sendAllWhatsApp(window._morningList);
        toast.remove();
    };

    var btnSkip = document.createElement('button');
    btnSkip.className = 'btn btn-ghost btn-sm';
    btnSkip.textContent = 'Sonra';
    btnSkip.onclick = function() { toast.remove(); };

    toast.innerHTML = '<div style="display:flex;align-items:flex-start;gap:12px;">' +
        '<span style="font-size:24px;flex-shrink:0;">&#x1F4AC;</span>' +
        '<div style="flex:1;">' +
            '<div style="font-weight:600;font-size:14px;color:var(--ink);margin-bottom:4px;">Yarin ' + list.length + ' seans var</div>' +
            '<div style="font-size:12px;color:var(--stone);margin-bottom:10px;">' +
                list.map(function(x) { return x.client.name + ' - ' + x.session.time; }).join('<br>') +
            '</div>' +
        '</div></div>';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    btns.appendChild(btnSend);
    btns.appendChild(btnSkip);
    toast.appendChild(btns);
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 30000);
}

// ─── GLOBAL EXPORTS ──────────────────────────────────────────
window.sendWhatsAppReminder        = sendWhatsAppReminder;
window.sendWhatsAppPaymentReminder = sendWhatsAppPaymentReminder;
window.sendWhatsAppBirthday        = sendWhatsAppBirthday;
window.sendWhatsAppWelcome         = sendWhatsAppWelcome;
window.sendWhatsAppPackageLow      = sendWhatsAppPackageLow;
window.sendWhatsAppPaymentReceived = sendWhatsAppPaymentReceived;
window.openWAComposer              = openWAComposer;
window.selectWATemplate            = selectWATemplate;
window.updateWACharCount           = updateWACharCount;
window.sendFromComposer            = sendFromComposer;
window.sendAllWhatsApp             = sendAllWhatsApp;
window.sendNextWa                  = sendNextWa;
window.cancelWaQueue               = cancelWaQueue;
window.openNotificationsPanel      = openNotificationsPanel;
window.showBirthdayAlert           = showBirthdayAlert;
window.checkMorningReminder        = checkMorningReminder;
window.requestPushPermission       = requestPushPermission;
window.sendPushNotification        = sendPushNotification;
window.getTomorrowSessions         = getTomorrowSessions;
window.checkBirthdays              = checkBirthdays;
