(function () {
  'use strict';

  function extractReportData() {
    const container = document.getElementById('reportContent');
    if (!container) {
      return {
        title: 'تقرير الشحنات',
        lines: []
      };
    }

    const titleElement = container.querySelector('h3');
    const listItems = Array.from(container.querySelectorAll('li'));

    return {
      title: titleElement ? titleElement.textContent.trim() : 'تقرير الشحنات',
      lines: listItems.map((item) => item.textContent.trim())
    };
  }

  function formatLines(doc, lines, startY, rightMargin) {
    let currentY = startY;
    const lineHeight = 26;

    lines.forEach((line) => {
      if (!line) {
        return;
      }
      doc.text(line, rightMargin, currentY, { align: 'right', baseline: 'top' });
      currentY += lineHeight;
    });
  }

  window.generateReport = function generateReport() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('تعذر تحميل مكتبة التقارير.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const data = extractReportData();
    const exportDate = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const rightMargin = pageWidth - 72;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Ghadeer Logistics', 72, 72, { baseline: 'top' });

    doc.setFontSize(20);
    doc.text(data.title, rightMargin, 110, { align: 'right', baseline: 'top' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`تاريخ التصدير: ${exportDate}`, rightMargin, 140, { align: 'right', baseline: 'top' });

    doc.setDrawColor(168, 85, 247);
    doc.setLineWidth(2);
    doc.line(72, 155, rightMargin, 155);

    doc.setFontSize(14);
    formatLines(doc, data.lines, 190, rightMargin);

    doc.save('ghadeer-logistics-report.pdf');
  };
})();
