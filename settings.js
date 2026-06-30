// ============================================================
// settings.js — İşletme Profili & Tema Ayarları
// ============================================================
import { saveProfile, getProfile } from './firebase-config.js';

// Renk temaları
const THEMES = {
    sage: {
        label: 'Adaçayı (Varsayılan)',
        emoji: '🌿',
        vars: {
            '--sage':       '#8fada1',
            '--sage-light': '#c4d7d1',
            '--sage-dark':  '#5f8076',
            '--blush':      '#e8b4b8',
            '--blush-light':'#f5dfe1',
            '--blush-dark': '#c97b82',
            '--lavender':   '#b8a9d4',
            '--lav-light':  '#e2ddf0',
            '--lav-dark':   '#7d6baa',
        }
    },
    ocean: {
        label: 'Okyanus',
        emoji: '🌊',
        vars: {
            '--sage':       '#7aafc0',
            '--sage-light': '#b8dce8',
            '--sage-dark':  '#3d7d96',
            '--blush':      '#a8d4e0',
            '--blush-light':'#d6eef4',
            '--blush-dark': '#4e9ab0',
            '--lavender':   '#90bfd4',
            '--lav-light':  '#cce5ef',
            '--lav-dark':   '#2e6e88',
        }
    },
    rose: {
        label: 'Gül',
        emoji: '🌸',
        vars: {
            '--sage':       '#c4909a',
            '--sage-light': '#e8c4c9',
            '--sage-dark':  '#96606a',
            '--blush':      '#d4a0aa',
            '--blush-light':'#f0d8db',
            '--blush-dark': '#a06070',
            '--lavender':   '#c8a8b8',
            '--lav-light':  '#ead8e4',
            '--lav-dark':   '#906080',
        }
    },
    lavender: {
        label: 'Lavanta',
        emoji: '💜',
        vars: {
            '--sage':       '#9d8fc4',
            '--sage-light': '#cdc6e4',
            '--sage-dark':  '#6d5fa0',
            '--blush':      '#b8aad4',
            '--blush-light':'#ddd8f0',
            '--blush-dark': '#8070b0',
            '--lavender':   '#b0a8d0',
            '--lav-light':  '#dcd8ec',
            '--lav-dark':   '#7060a8',
        }
    },
    forest: {
        label: 'Orman',
        emoji: '🌲',
        vars: {
            '--sage':       '#7a9e7e',
            '--sage-light': '#b8d4ba',
            '--sage-dark':  '#4a7050',
            '--blush':      '#a8c8a4',
            '--blush-light':'#d4e8d2',
            '--blush-dark': '#5a8460',
            '--lavender':   '#90b494',
            '--lav-light':  '#c4dac6',
            '--lav-dark':   '#406044',
        }
    },
    sunset: {
        label: 'Gün Batımı',
        emoji: '🌅',
        vars: {
            '--sage':       '#c4956a',
            '--sage-light': '#e4c4a0',
            '--sage-dark':  '#9a6840',
            '--blush':      '#d4a880',
            '--blush-light':'#ecd4b8',
            '--blush-dark': '#a87050',
            '--lavender':   '#c8a888',
            '--lav-light':  '#e8d4c0',
            '--lav-dark':   '#986040',
        }
    },
};

// Varsayılan profil
const DEFAULT_PROFILE = {
    businessName: 'Stulio',
    tagline:      'Fizyoterapi · Pilates · Yoga',
    logoEmoji:    '🌿',
    phone:        '',
    address:      '',
    email:        '',
    website:      '',
    theme:        'sage',
};

let _currentProfile = { ...DEFAULT_PROFILE };

// ─── PROFİL UYGULA ──────────────────────────────────────────

function applyProfile(profile) {
    _currentProfile = { ...DEFAULT_PROFILE, ...profile };

    // Başlık
    const nameEl  = document.querySelector('.brand-text h1');
    const tagEl   = document.querySelector('.brand-text p');
    const iconEl  = document.querySelector('.brand-icon');
    const titleEl = document.querySelector('title');

    if (nameEl)  nameEl.textContent  = _currentProfile.businessName || DEFAULT_PROFILE.businessName;
    if (tagEl)   tagEl.textContent   = _currentProfile.tagline      || DEFAULT_PROFILE.tagline;
    if (iconEl)  iconEl.textContent  = _currentProfile.logoEmoji    || DEFAULT_PROFILE.logoEmoji;
    if (titleEl) titleEl.textContent = (_currentProfile.businessName || 'Stulio') + ' — Studio';

    // Tema
    applyTheme(_currentProfile.theme || 'sage');
}

function applyTheme(themeKey) {
    const theme = THEMES[themeKey] || THEMES.sage;
    const root  = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// ─── AYARLAR MODAL ──────────────────────────────────────────

function openSettings() {
    const existing = document.getElementById('settingsModal');
    if (existing) existing.remove();

    const p = _currentProfile;

    const modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;">
            <div class="modal-header">
                <h3>⚙️ İşletme Ayarları</h3>
                <button class="close-btn" onclick="document.getElementById('settingsModal').remove()">✕</button>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:0;">

                <!-- Canlı önizleme -->
                <div id="settingsPreview" style="
                    background: linear-gradient(135deg, var(--sage-light) 0%, var(--lav-light) 100%);
                    border-radius: var(--r-md);
                    padding: 18px 20px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    border: 1px solid var(--border-soft);
                ">
                    <div id="prevIcon" style="width:52px; height:52px; background:white; border-radius:var(--r-md);
                         display:flex; align-items:center; justify-content:center; font-size:28px;
                         box-shadow:var(--shadow-sm);">${p.logoEmoji || '🌿'}</div>
                    <div>
                        <div id="prevName" style="font-family:'Playfair Display',serif; font-size:1.2rem; font-weight:600; color:var(--sage-dark);">
                            ${p.businessName || 'İşletme Adı'}
                        </div>
                        <div id="prevTagline" style="font-size:12px; color:var(--stone); text-transform:uppercase; letter-spacing:.05em; margin-top:2px;">
                            ${p.tagline || 'Alt başlık'}
                        </div>
                    </div>
                </div>

                <!-- Form -->
                <div class="form-group">
                    <label>İşletme Adı *</label>
                    <input type="text" id="set_name" value="${p.businessName || ''}" placeholder="Örn: Sağlık Fizyoterapi Merkezi"
                        oninput="document.getElementById('prevName').textContent=this.value||'İşletme Adı'">
                </div>

                <div class="form-group">
                    <label>Alt Başlık</label>
                    <input type="text" id="set_tagline" value="${p.tagline || ''}" placeholder="Örn: Pilates · Yoga · Fizyoterapi"
                        oninput="document.getElementById('prevTagline').textContent=this.value||'Alt başlık'">
                </div>

                <div class="form-group">
                    <label>Logo Emoji</label>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                        ${['🌿','🏥','💆','🧘','🌸','⚕️','💪','🌺','✨','🌱','🦋','❤️','🏃','🎯','⭐'].map(e =>
                            `<button type="button" onclick="selectEmoji('${e}')" style="
                                width:38px; height:38px; border:2px solid var(--border);
                                border-radius:var(--r-sm); background:var(--surface-2);
                                font-size:20px; cursor:pointer; transition:all .15s;
                                ${p.logoEmoji===e ? 'border-color:var(--sage-dark); background:var(--sage-light);' : ''}
                            " id="emojiBtn_${e}">${e}</button>`
                        ).join('')}
                    </div>
                    <input type="text" id="set_emoji" value="${p.logoEmoji || '🌿'}" placeholder="Emoji girin"
                        oninput="updateEmojiPreview(this.value)" style="width:100px;">
                </div>

                <div class="divider"></div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Telefon</label>
                        <input type="tel" id="set_phone" value="${p.phone || ''}" placeholder="0212 XXX XX XX">
                    </div>
                    <div class="form-group">
                        <label>E-posta</label>
                        <input type="email" id="set_email" value="${p.email || ''}" placeholder="info@isletme.com">
                    </div>
                </div>

                <div class="form-group">
                    <label>Adres</label>
                    <input type="text" id="set_address" value="${p.address || ''}" placeholder="Mahalle, Sokak, İlçe / İl">
                </div>

                <div class="form-group">
                    <label>Website</label>
                    <input type="text" id="set_website" value="${p.website || ''}" placeholder="www.isletmem.com">
                </div>

                <div class="divider"></div>

                <!-- Seans Türleri -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px;
                     background:var(--surface-2); border-radius:var(--r-md); border:1px solid var(--border-soft); margin-bottom:16px;">
                    <div>
                        <div style="font-size:13px; font-weight:600; color:var(--ink);">🏷️ Seans Türleri</div>
                        <div style="font-size:12px; color:var(--stone); margin-top:2px;">Fizyoterapi, nail, güzellik... kendi türlerinizi ekleyin</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('settingsModal').remove(); openSessionTypesModal()">
                        Düzenle →
                    </button>
                </div>

                <!-- Eğitmenler / Hocalar -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px;
                     background:var(--surface-2); border-radius:var(--r-md); border:1px solid var(--border-soft); margin-bottom:16px;">
                    <div>
                        <div style="font-size:13px; font-weight:600; color:var(--ink);">👩‍🏫 Eğitmenler / Hocalar</div>
                        <div style="font-size:12px; color:var(--stone); margin-top:2px;">Komisyon oranlarını ve personeli yönetin</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('settingsModal').remove(); openInstructorsModal()">
                        Düzenle →
                    </button>
                </div>

                <div class="divider"></div>

                <div class="form-group" style="margin-bottom:0;">
                    <label>Renk Teması</label>
                    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:4px;">
                        ${Object.entries(THEMES).map(([key, theme]) => `
                        <button type="button" id="themeBtn_${key}" onclick="previewTheme('${key}')"
                            style="padding:10px 8px; border-radius:var(--r-md); cursor:pointer; transition:all .2s;
                                   border:2px solid ${(p.theme||'sage')===key ? 'var(--sage-dark)' : 'var(--border)'};
                                   background:${(p.theme||'sage')===key ? 'var(--sage-light)' : 'var(--surface-2)'};
                                   font-size:13px; font-weight:500;">
                            ${theme.emoji} ${theme.label}
                        </button>`).join('')}
                    </div>
                </div>

            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('settingsModal').remove(); applyProfile(window._currentProfile)">
                    İptal
                </button>
                <button class="btn btn-primary" onclick="saveSettings()">
                    💾 Kaydet
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

let _pendingTheme = _currentProfile.theme || 'sage';

function previewTheme(key) {
    _pendingTheme = key;
    applyTheme(key);
    // Update button styles
    Object.keys(THEMES).forEach(k => {
        const btn = document.getElementById('themeBtn_' + k);
        if (!btn) return;
        btn.style.borderColor = k === key ? 'var(--sage-dark)' : 'var(--border)';
        btn.style.background  = k === key ? 'var(--sage-light)' : 'var(--surface-2)';
    });
}

function selectEmoji(emoji) {
    document.getElementById('set_emoji').value = emoji;
    updateEmojiPreview(emoji);
    // Update button highlights
    document.querySelectorAll('[id^="emojiBtn_"]').forEach(btn => {
        btn.style.borderColor = 'var(--border)';
        btn.style.background  = 'var(--surface-2)';
    });
    const active = document.getElementById('emojiBtn_' + emoji);
    if (active) {
        active.style.borderColor = 'var(--sage-dark)';
        active.style.background  = 'var(--sage-light)';
    }
}

function updateEmojiPreview(emoji) {
    const prev = document.getElementById('prevIcon');
    if (prev) prev.textContent = emoji || '🌿';
}

async function saveSettings() {
    const name    = document.getElementById('set_name')?.value.trim();
    const tagline = document.getElementById('set_tagline')?.value.trim();
    const emoji   = document.getElementById('set_emoji')?.value.trim();
    const phone   = document.getElementById('set_phone')?.value.trim();
    const email   = document.getElementById('set_email')?.value.trim();
    const address = document.getElementById('set_address')?.value.trim();
    const website = document.getElementById('set_website')?.value.trim();

    if (!name) {
        showNotification('İşletme adı zorunlu', 'error');
        return;
    }

    const profile = {
        businessName: name,
        tagline:      tagline  || DEFAULT_PROFILE.tagline,
        logoEmoji:    emoji    || DEFAULT_PROFILE.logoEmoji,
        phone:        phone    || '',
        email:        email    || '',
        address:      address  || '',
        website:      website  || '',
        theme:        _pendingTheme || 'sage',
        updatedAt:    new Date().toISOString(),
    };

    // Firestore'a kaydet
    try {
        const uid = window._currentUserId;
        if (uid) {
            await saveProfile(uid, profile);
        }
    } catch(e) {
        console.warn('Profil Firestore kaydı başarısız:', e);
    }

    // localStorage yedek (misafir veya offline)
    try { localStorage.setItem('studioProfile', JSON.stringify(profile)); } catch(e) {}

    applyProfile(profile);
    document.getElementById('settingsModal')?.remove();
    showNotification('Ayarlar kaydedildi ✓', 'success');
}

// ─── PROFİL YÜKLE ───────────────────────────────────────────

async function loadAndApplyProfile(userId) {
    window._currentUserId = userId;
    let profile = null;

    // Firestore'dan dene
    try {
        try {
            profile = await getProfile(userId);
        } catch(e2) { console.warn('getProfile:', e2); }
    } catch(e) {
        console.warn('Profil Firestore yüklenemedi:', e);
    }

    // localStorage yedek
    if (!profile) {
        try {
            const stored = localStorage.getItem('studioProfile');
            if (stored) profile = JSON.parse(stored);
        } catch(e) {}
    }

    if (profile) applyProfile(profile);
}

// ─── GLOBAL'E AÇ ─────────────────────────────────────────────
window.openSettings          = openSettings;
window.saveSettings          = saveSettings;
window.applyProfile          = applyProfile;
window.loadAndApplyProfile   = loadAndApplyProfile;
window.previewTheme          = previewTheme;
window.selectEmoji           = selectEmoji;
window.updateEmojiPreview    = updateEmojiPreview;
window._currentProfile       = _currentProfile;
