// trial.js
// Kullanıcının 7 günlük deneme süresini yönetir.
// Kullanım:
//   import { checkTrial, markTrialStart, TRIAL_DAYS } from './trial.js';
//   const status = await checkTrial(userId);
//   if (status.expired) showPaywall();

import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const TRIAL_DAYS = 7;

// Deneme başlangıcını kaydet (kayıt olunca bir kez çağır)
export async function markTrialStart(userId) {
    const ref = doc(db, "users", userId, "profile", "main");
    const snap = await getDoc(ref);

    // Zaten kaydedilmişse tekrar yazma
    if (snap.exists() && snap.data().trialStartedAt) return;

    await setDoc(ref, {
        trialStartedAt: new Date().toISOString()
    }, { merge: true });
}

// Deneme durumunu kontrol et
// Dönen obje: { active, expired, daysLeft, trialStartedAt }
export async function checkTrial(userId) {
    const ref = doc(db, "users", userId, "profile", "main");
    const snap = await getDoc(ref);

    if (!snap.exists() || !snap.data().trialStartedAt) {
        // Profil yoksa denemeyi başlat
        await markTrialStart(userId);
        return { active: true, expired: false, daysLeft: TRIAL_DAYS };
    }

    const data = snap.data();
    const startDate = new Date(data.trialStartedAt);
    const now = new Date();
    const diffMs = now - startDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, TRIAL_DAYS - diffDays);
    const expired = diffDays >= TRIAL_DAYS;

    // Ödeme yapılmışsa süre geçmiş olsa da aktif
    if (data.isPaid) {
        return { active: true, expired: false, daysLeft: 999, isPaid: true };
    }

    return {
        active: !expired,
        expired,
        daysLeft,
        trialStartedAt: data.trialStartedAt
    };
}

// Ödeme yapıldığında çağır (şimdilik manuel, ileride otomatik)
export async function markAsPaid(userId) {
    const ref = doc(db, "users", userId, "profile", "main");
    await setDoc(ref, {
        isPaid: true,
        paidAt: new Date().toISOString()
    }, { merge: true });
}
