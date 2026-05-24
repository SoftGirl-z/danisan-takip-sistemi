// reports.js

function generateMonthlyReport() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthSessions = sessions.filter(s => new Date(s.date) >= startOfMonth);
    const monthIncome = payments
        .filter(p => new Date(p.date) >= startOfMonth)
        .reduce((sum, p) => sum + p.amount, 0);
    
    const report = {
        period: `${startOfMonth.toLocaleDateString('tr-TR')} - ${now.toLocaleDateString('tr-TR')}`,
        totalSessions: monthSessions.length,
        totalIncome: monthIncome,
        sessionsByType: {},
        topClients: getTopClients(5),
        avgSessionsPerDay: (monthSessions.length / now.getDate()).toFixed(1)
    };
    
    // Türe göre grup

la
    monthSessions.forEach(s => {
        report.sessionsByType[s.type] = (report.sessionsByType[s.type] || 0) + 1;
    });
    
    return report;
}