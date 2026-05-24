// export.js

// Excel export (SheetJS kullanarak)
function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    // Danışanlar sayfası
    const clientsWs = XLSX.utils.json_to_sheet(clients);
    XLSX.utils.book_append_sheet(wb, clientsWs, 'Danışanlar');
    
    // Seanslar sayfası
    const sessionsWs = XLSX.utils.json_to_sheet(sessions);
    XLSX.utils.book_append_sheet(wb, sessionsWs, 'Seanslar');
    
    // Paketler sayfası
    const packagesWs = XLSX.utils.json_to_sheet(packages);
    XLSX.utils.book_append_sheet(wb, packagesWs, 'Paketler');
    
    XLSX.writeFile(wb, `rapor-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// PDF export (jsPDF kullanarak)
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Danışan Raporu', 20, 20);
    
    doc.setFontSize(12);
    let y = 40;
    
    clients.forEach((client, index) => {
        doc.text(`${index + 1}. ${client.name} - ${client.phone}`, 20, y);
        y += 10;
        
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
    });
    
    doc.save(`rapor-${Date.now()}.pdf`);
}