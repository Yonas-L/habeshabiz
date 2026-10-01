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
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`downloadPdf: element #${elementId} not found`);
    onDone?.();
    return;
  }

  onStart?.();

  try {
    // A4 dimensions in mm
    const PAGE_W_MM = 210;
    const PAGE_H_MM = 297;
    const MARGIN_MM = 10;
    const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;

    // Render the element at 2× for retina-quality output
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgW = canvas.width;
    const imgH = canvas.height;

    // How many pixels correspond to one mm at this scale?
    const pxPerMm = imgW / CONTENT_W_MM;

    // Content height available per page in px
    const pageContentH_px = (PAGE_H_MM - MARGIN_MM * 2) * pxPerMm;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yOffset = 0; // current vertical position in the source canvas (px)
    let pageIndex = 0;

    while (yOffset < imgH) {
      if (pageIndex > 0) pdf.addPage();

      // Height of this slice in px (last slice may be shorter)
      const sliceH_px = Math.min(pageContentH_px, imgH - yOffset);

      // Create a temporary canvas for this slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgW;
      sliceCanvas.height = sliceH_px;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, yOffset, imgW, sliceH_px, 0, 0, imgW, sliceH_px);
      }

      const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.97);
      const sliceH_mm = sliceH_px / pxPerMm;

      pdf.addImage(
        sliceDataUrl,
        'JPEG',
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_W_MM,
        sliceH_mm,
      );

      yOffset += sliceH_px;
      pageIndex++;
    }

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error('downloadPdf error:', err);
  } finally {
    onDone?.();
  }
}
