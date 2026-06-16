import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { showError } from '@/utils/toast';

type GeneratePdfOptions = {
  fitToOnePage?: boolean;
  format?: 'a4' | 'letter';
};

export const generatePdf = async (element: HTMLElement, fileName: string, options: GeneratePdfOptions = {}) => {
  const originalWidth = element.style.width;
  const originalHeight = element.style.height;
  const originalOverflow = element.style.overflow;
  const originalBackground = element.style.backgroundColor;

  try {
    // Force an A4-friendly content width. 720px maps cleanly into A4 with margins.
    element.style.width = '720px';
    element.style.height = 'auto';
    element.style.overflow = 'visible';
    element.style.backgroundColor = '#ffffff';
    element.classList.add('pdf-exporting');

    // Hide elements marked with .no-pdf class
    const elementsToHide = element.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    // Wait a brief moment for DOM layout updates
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // Allow loading cross-origin images (like Supabase storage logos)
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 720
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', options.format || 'letter');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = options.fitToOnePage ? 6 : 10;
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = pdfHeight - margin * 2;

    const pageCanvas = document.createElement('canvas');
    const pageContext = pageCanvas.getContext('2d');

    if (!pageContext) {
      throw new Error('Canvas context is unavailable');
    }

    if (options.fitToOnePage) {
      const fullHeight = (canvas.height * contentWidth) / canvas.width;
      const fittedHeight = Math.min(fullHeight, contentHeight);
      const fittedWidth = fullHeight > contentHeight ? (canvas.width * fittedHeight) / canvas.height : contentWidth;
      const x = margin + (contentWidth - fittedWidth) / 2;

      pdf.addImage(imgData, 'PNG', x, margin, fittedWidth, fittedHeight);
      pdf.save(fileName);

      elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
      element.classList.remove('pdf-exporting');
      element.style.width = originalWidth;
      element.style.height = originalHeight;
      element.style.overflow = originalOverflow;
      element.style.backgroundColor = originalBackground;

      return true;
    }

    const pageCanvasHeight = Math.floor((contentHeight * canvas.width) / contentWidth);
    pageCanvas.width = canvas.width;
    pageCanvas.height = pageCanvasHeight;

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
      pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.fillStyle = '#ffffff';
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        renderedHeight,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const pageImgData = pageCanvas.toDataURL('image/png');
      const pageImgHeight = (sliceHeight * contentWidth) / canvas.width;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageImgHeight);

      renderedHeight += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(fileName);

    // Restore original styles
    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
    element.classList.remove('pdf-exporting');
    element.style.width = originalWidth;
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;
    element.style.backgroundColor = originalBackground;

    return true;
  } catch (err) {
    console.error("Error generating PDF", err);
    showError("Gagal membuat PDF. Pastikan gambar sudah termuat sepenuhnya.");
    
    // Restore styles in case of error
    const elementsToHide = element.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
    element.classList.remove('pdf-exporting');
    element.style.width = originalWidth;
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;
    element.style.backgroundColor = originalBackground;
    
    return false;
  }
};
