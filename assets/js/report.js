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

  const PX_TO_PT = 0.75; // assumes the browser renders canvas text at 96 DPI

  function drawArabicText(doc, text, rightEdge, topPosition, options = {}) {
    if (!text) {
      return 0;
    }

    const {
      fontSize = 16,
      fontWeight = 'normal',
      color = '#111827'
    } = options;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return 0;
    }

    const scale = window.devicePixelRatio || 1;
    const baseFont = `${fontWeight} ${fontSize}px "Cairo", "Tahoma", "Arial", sans-serif`;

    context.font = baseFont;
    context.direction = 'rtl';
    const metrics = context.measureText(text);
    const paddingX = 12;
    const paddingY = Math.ceil(fontSize * 0.35);
    const renderWidth = Math.ceil(metrics.width) + paddingX * 2;
    const renderHeight = Math.ceil(fontSize * 1.35) + paddingY * 2;

    canvas.width = renderWidth * scale;
    canvas.height = renderHeight * scale;

    context.scale(scale, scale);
    context.clearRect(0, 0, renderWidth, renderHeight);
    context.font = baseFont;
    context.fillStyle = color;
    context.textBaseline = 'top';
    context.textAlign = 'right';
    context.direction = 'rtl';
    context.fillText(text, renderWidth - paddingX, paddingY);

    const dataUrl = canvas.toDataURL('image/png');
    const widthPt = renderWidth * PX_TO_PT;
    const heightPt = renderHeight * PX_TO_PT;
    const left = rightEdge - widthPt;

    doc.addImage(dataUrl, 'PNG', left, topPosition, widthPt, heightPt, undefined, 'FAST');

    return heightPt;
  }

  function formatLines(doc, lines, startY, rightMargin) {
    let currentY = startY;

    lines.forEach((line) => {
      const height = drawArabicText(doc, line, rightMargin, currentY, { fontSize: 14 });
      if (height) {
        currentY += height + 10;
      }
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
    drawArabicText(doc, data.title, rightMargin, 110, { fontSize: 20, fontWeight: 'bold' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    drawArabicText(doc, `تاريخ التصدير: ${exportDate}`, rightMargin, 140, { fontSize: 12 });

    doc.setDrawColor(168, 85, 247);
    doc.setLineWidth(2);
    doc.line(72, 155, rightMargin, 155);

    doc.setFontSize(14);
    formatLines(doc, data.lines, 190, rightMargin);

    doc.save('ghadeer-logistics-report.pdf');
  };
})();
