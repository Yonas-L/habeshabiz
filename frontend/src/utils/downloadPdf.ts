import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures a DOM element and downloads it as a properly paginated A4 PDF.
 *
 * @param elementId  - The id of the element to capture (e.g. "printable-statement")
 * @param filename   - The output filename without extension (e.g. "Statement_VendorName")
 * @param onStart    - Optional callback fired before capture begins (e.g. show a spinner)
 * @param onDone     - Optional callback fired after download completes or on error
 */
export async function downloadPdf(
  elementId: string,
  filename: string,
  onStart?: () => void,
  onDone?: () => void,
  options: { revealBranding?: boolean; revealTableBranding?: boolean; expandScrollAreas?: boolean; paginateSections?: boolean; singleTable?: boolean } = {},
  onError?: (error: unknown) => void,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`downloadPdf: element #${elementId} not found`);
    onDone?.();
    return;
  }

  onStart?.();

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    }));

    // A4 dimensions in mm
    const PAGE_W_MM = 210;
    const PAGE_H_MM = 297;
    const MARGIN_MM = 10;
    const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfPages = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-page]'));
    const isMultiPageDocument = pdfPages.length > 0;

    const sections = options.paginateSections
      ? Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-section]'))
      : [element];
    const captureTargets = isMultiPageDocument ? pdfPages : (sections.length > 0 ? sections : [element]);
    let pageIndex = 0;

    for (const target of captureTargets) {
      if (isMultiPageDocument) {
        // Multi-page document: each [data-pdf-page] is a dedicated, complete A4 page.
        // Render it directly without blind slicing to ensure zero row-cutting.
        const canvas = await html2canvas(target, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          foreignObjectRendering: false,
          onclone: (clonedDocument) => {
            clonedDocument.documentElement.classList.remove('dark');
            clonedDocument.body.classList.remove('dark');
            clonedDocument.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((page) => {
              page.style.boxShadow = 'none';
              page.style.border = 'none';
              page.style.borderRadius = '0';
              page.style.backgroundColor = '#ffffff';
              page.style.color = '#0f172a';
            });
          },
        });

        if (pageIndex > 0) pdf.addPage();
        const imgW = canvas.width;
        const imgH = canvas.height;
        const pxPerMm = imgW / CONTENT_W_MM;
        const contentH_mm = Math.min(PAGE_H_MM - MARGIN_MM * 2, imgH / pxPerMm);

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_W_MM, contentH_mm);
        pageIndex++;
        continue;
      }

      // Render each report section separately. This avoids browser canvas-size
      // limits that can blank or truncate a long multi-table report.
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        foreignObjectRendering: false,
        windowWidth: 880, // Calibrated viewport for A4 width (190mm) allowing crisp 2-column tables
        onclone: (clonedDocument) => {
          // ── Force light mode so dark backgrounds / light text don't bleed into the white PDF ──
          clonedDocument.documentElement.classList.remove('dark');
          clonedDocument.body.classList.remove('dark');
          clonedDocument.documentElement.style.colorScheme = 'light';
          clonedDocument.documentElement.style.backgroundColor = '#ffffff';
          clonedDocument.body.style.backgroundColor = '#ffffff';

          // ── Hide interactive-only controls (download buttons, etc.) ──
          clonedDocument.querySelectorAll<HTMLElement>('[data-pdf-control]').forEach((node) => {
            node.style.display = 'none';
          });

          // ── Hide screen-only sections that carry the print:hidden class ──
          clonedDocument.querySelectorAll<HTMLElement>('[class*="print:hidden"]').forEach((node) => {
            node.style.display = 'none';
          });

          // ── Reveal PDF branding elements (document header & signature footer) ──
          if (options.revealBranding) {
            clonedDocument.querySelectorAll<HTMLElement>('[data-pdf-header], [data-pdf-footer]').forEach((node) => {
              node.style.display = 'block';
              node.classList.remove('hidden');
            });
          }

          // ── Table-level mini brand header (only for single table download, NOT full report) ──
          clonedDocument.querySelectorAll<HTMLElement>('[data-pdf-brand]').forEach((node) => {
            if (options.revealTableBranding) {
              node.style.display = 'flex';
              node.classList.remove('hidden');
            } else {
              node.style.display = 'none';
            }
          });

          // ── Reveal print-only blocks (signature footer, etc.) ──
          clonedDocument.querySelectorAll<HTMLElement>('[class*="print:block"]').forEach((node) => {
            if (node.classList.contains('hidden')) {
              node.style.display = 'block';
              node.classList.remove('hidden');
            }
          });

          // ── Make a single-table export a full-width A4 report, not a narrow
          // grid child from the two-column screen layout. ──
          if (options.singleTable) {
            const reportSection = clonedDocument.getElementById(elementId);
            if (reportSection) {
              reportSection.style.width = '760px';
              reportSection.style.maxWidth = '760px';
              reportSection.style.margin = '0 auto';
              reportSection.style.overflow = 'visible';
            }
          }

          // ── Keep report tables inside their columns and wrap long labels
          // instead of allowing them to spill outside the PDF page. ──
          clonedDocument.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
            table.style.width = '100%';
            table.style.maxWidth = '100%';
            table.style.tableLayout = 'fixed';
            table.style.borderCollapse = 'collapse';
            table.querySelectorAll<HTMLElement>('th, td').forEach((cell) => {
              cell.style.whiteSpace = 'normal';
              cell.style.overflowWrap = 'anywhere';
              cell.style.wordBreak = 'break-word';
              cell.style.verticalAlign = 'top';
            });
          });

          // ── Ensure 2-column report layout remains 2 columns in PDF print ──
          clonedDocument.querySelectorAll<HTMLElement>('.lg\\:grid-cols-2').forEach((grid) => {
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            grid.style.gap = '16px';
          });

          // ── Convert dark-mode card backgrounds and text to crisp light print styles ──
          clonedDocument.querySelectorAll<HTMLElement>('.dark\\:bg-\\[\\#131926\\], .bg-\\[\\#131926\\], .dark\\:bg-slate-900').forEach((el) => {
            el.style.backgroundColor = '#ffffff';
          });
          clonedDocument.querySelectorAll<HTMLElement>('.dark\\:bg-slate-900\\/70, .dark\\:bg-slate-900\\/40, .dark\\:bg-slate-900\\/80, .dark\\:bg-slate-900\\/50').forEach((el) => {
            el.style.backgroundColor = '#f8fafc';
          });
          clonedDocument.querySelectorAll<HTMLElement>('.dark\\:text-white').forEach((el) => {
            el.style.color = '#0f172a';
          });
          clonedDocument.querySelectorAll<HTMLElement>('.dark\\:text-slate-200, .dark\\:text-slate-300').forEach((el) => {
            el.style.color = '#334155';
          });
          clonedDocument.querySelectorAll<HTMLElement>('.dark\\:text-slate-400, .dark\\:text-slate-500').forEach((el) => {
            el.style.color = '#64748b';
          });
          clonedDocument.querySelectorAll<HTMLElement>('.dark\\:border-slate-800, .dark\\:border-slate-700').forEach((el) => {
            el.style.borderColor = '#e2e8f0';
          });

          // ── Expand scroll-constrained areas to show full table content ──
          if (options.expandScrollAreas) {
            clonedDocument.querySelectorAll<HTMLElement>('[data-report-scroll]').forEach((node) => {
              node.style.height = 'auto';
              node.style.maxHeight = 'none';
              node.style.overflow = 'visible';
            });
          }
        },
      });

      const imgW = canvas.width;
      const imgH = canvas.height;
      const pxPerMm = imgW / CONTENT_W_MM;
      const pageContentHpx = (PAGE_H_MM - MARGIN_MM * 2) * pxPerMm;
      let yOffset = 0;

      while (yOffset < imgH) {
        if (pageIndex > 0) pdf.addPage();
        const sliceHpx = Math.min(pageContentHpx, imgH - yOffset);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgW;
        sliceCanvas.height = Math.ceil(sliceHpx);
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not prepare the PDF page canvas.');
        ctx.drawImage(canvas, 0, yOffset, imgW, sliceHpx, 0, 0, imgW, sliceHpx);
        const sliceH_mm = sliceHpx / pxPerMm;
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_W_MM, sliceH_mm);
        yOffset += sliceHpx;
        pageIndex++;
      }
    }

    const blob = pdf.output('blob');
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${filename}.pdf`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (err) {
    console.error('downloadPdf error:', err);
    try {
      await downloadStructuredPdf(element, filename, options);
    } catch (fallbackError) {
      console.error('structured PDF fallback error:', fallbackError);
      onError?.(fallbackError);
    }
  } finally {
    onDone?.();
  }
}

/**
 * CSS-independent fallback for browsers that cannot rasterize the app's
 * modern Tailwind styles. It draws the actual DOM table cells as vector text,
 * so the resulting PDF remains readable and paginates reliably.
 */
async function downloadStructuredPdf(
  element: HTMLElement,
  filename: string,
  options: { paginateSections?: boolean },
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const sections = options.paginateSections
    ? Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-section]'))
    : [element];
  const targets = sections.length > 0 ? sections : [element];
  let pageIndex = 0;

  const addHeader = async (target: HTMLElement) => {
    if (pageIndex > 0) pdf.addPage();
    pageIndex += 1;
    const brand = target.querySelector<HTMLElement>('[data-pdf-brand]');
    const heading = target.querySelector('h2')?.textContent?.trim() || brand?.textContent?.trim() || 'Business Report';
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    const logo = target.querySelector<HTMLImageElement>('[data-pdf-brand] img');
    if (logo?.src) {
      try {
        const response = await fetch(logo.src, { mode: 'cors' });
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        pdf.addImage(dataUrl, blob.type.includes('png') ? 'PNG' : 'JPEG', margin, margin - 5, 10, 10);
      } catch {
        // A missing logo must not prevent the financial report from downloading.
      }
    }
    pdf.text(heading.split('\n').map((line) => line.trim()).filter(Boolean).slice(-1)[0] || heading, pageWidth / 2, margin, { align: 'center' });
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, margin + 5, pageWidth - margin, margin + 5);
    return margin + 14;
  };

  for (const target of targets) {
    let y = await addHeader(target);
    const table = target.querySelector('table');
    if (!table) {
      const lines = pdf.splitTextToSize(target.textContent?.replace(/\s+/g, ' ').trim() || '', usableWidth);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(lines, margin, y);
      continue;
    }

    const headerElements = Array.from(table.querySelectorAll('thead th'));
    const headerCells = headerElements.map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '');
    const rows = Array.from(table.querySelectorAll('tbody tr, tfoot tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td')).map((cell) => ({
        text: cell.textContent?.replace(/\s+/g, ' ').trim() || '',
        align: cell.className.includes('text-right') ? 'right' : cell.className.includes('text-center') ? 'center' : 'left',
        total: row.parentElement?.tagName.toLowerCase() === 'tfoot',
      }))
    );
    const columnCount = Math.max(headerCells.length, ...rows.map((row) => row.length), 1);
    const widthWeights = columnCount === 2
      ? [0.68, 0.32]
      : columnCount === 3
      ? [0.52, 0.20, 0.28]
      : columnCount === 5
      ? [0.30, 0.13, 0.13, 0.20, 0.24]
      : Array.from({ length: columnCount }, (_, index) => index === 0 ? 0.45 : 0.55 / (columnCount - 1));
    const columnWidths = Array.from({ length: columnCount }, (_, index) => usableWidth * (widthWeights[index] || 1 / columnCount));
    const columnStarts = columnWidths.reduce<number[]>((starts, _width, index) => {
      starts.push(index === 0 ? margin : starts[index - 1] + columnWidths[index - 1]);
      return starts;
    }, []);
    const drawRow = (cells: Array<{ text: string; align: string; total?: boolean }> | string[], header = false, rowIndex = 0) => {
      const normalizedCells = cells.slice(0, columnCount).map((cell) => typeof cell === 'string' ? { text: cell, align: 'left' } : cell);
      const wrapped = normalizedCells.map((cell, index) => pdf.splitTextToSize(cell.text || ' ', columnWidths[index] - 5));
      const rowHeight = Math.max(8, ...wrapped.map((lines) => lines.length * 4 + 4));
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        pageIndex += 1;
        y = margin;
        if (!header && headerCells.length > 0) drawRow(headerCells, true, -1);
      }
      if (header) {
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, y, usableWidth, rowHeight, 'F');
      } else if (rowIndex % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, usableWidth, rowHeight, 'F');
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, y, usableWidth, rowHeight);
      pdf.setFont('helvetica', header || normalizedCells.some((cell) => cell.total) ? 'bold' : 'normal');
      pdf.setFontSize(header ? 7.5 : 8.5);
      pdf.setTextColor(header ? 71 : 30, header ? 85 : 41, header ? 105 : 59);
      wrapped.forEach((lines, index) => {
        const cell = normalizedCells[index];
        const cellStart = columnStarts[index];
        const cellEnd = cellStart + columnWidths[index];
        const textX = cell.align === 'right' ? cellEnd - 2 : cell.align === 'center' ? cellStart + columnWidths[index] / 2 : cellStart + 2;
        const colorText = /(^|\s)[−-]\s*\d|\b(loss|outflow|expense|returned)\b/i.test(cell.text);
        const positiveText = /^\+|\b(inflow|profit|sold)\b/i.test(cell.text);
        if (!header && colorText) pdf.setTextColor(190, 24, 93);
        if (!header && positiveText && !colorText) pdf.setTextColor(5, 120, 87);
        pdf.text(lines, textX, y + 5, { align: cell.align as 'left' | 'center' | 'right' });
        pdf.setTextColor(header ? 71 : 30, header ? 85 : 41, header ? 105 : 59);
        if (index > 0) pdf.line(cellStart, y, cellStart, y + rowHeight);
      });
      y += rowHeight;
    };

    if (headerCells.length > 0) drawRow(headerCells, true, -1);
    rows.forEach((row, index) => drawRow(row, false, index));
  }

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
