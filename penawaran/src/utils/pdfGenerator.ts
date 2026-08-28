import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { showError, showSuccess } from '@/utils/toast';

type GeneratePdfOptions = {
  fitToOnePage?: boolean;
  format?: 'a4' | 'letter' | 'f4' | [number, number];
  continuous?: boolean;
};

/**
 * Standard PDF Generator for Invoices and Quotes (Full F4 / Folio 215x330mm Support)
 */
export const generatePdf = async (element: HTMLElement, fileName: string, options: GeneratePdfOptions = {}) => {
  const originalWidth = element.style.width;
  const originalHeight = element.style.height;
  const originalOverflow = element.style.overflow;
  const originalBackground = element.style.backgroundColor;

  // Temporarily remove dark class for pristine clean white PDF export
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark');
  }

  try {
    // Force a crisp content width. 760px maps cleanly into F4/A4 with margins.
    element.style.width = '760px';
    element.style.height = 'auto';
    element.style.overflow = 'visible';
    element.style.backgroundColor = '#ffffff';
    element.classList.add('pdf-exporting');

    // Hide elements marked with .no-pdf class
    const elementsToHide = element.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    // Wait a brief moment for DOM layout updates
    await new Promise(resolve => setTimeout(resolve, 80));

    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for crystal-clear quality
      useCORS: true, // Allow loading cross-origin images
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 760
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Standar Ukuran Kertas F4 Indonesia: 215mm x 330mm
    const pdfWidth = options.format === 'a4' ? 210 : 215;
    const pdfHeight = options.format === 'a4' ? 297 : 330;
    const margin = 8;
    const contentWidth = pdfWidth - margin * 2;

    // SINGLE CONTINUOUS LONG PDF (NO PAGE BREAKS)
    const renderedHeight = (canvas.height * contentWidth) / canvas.width;
    const continuousHeight = Math.max(renderedHeight + margin * 2, pdfHeight);
    const pdf = new jsPDF('p', 'mm', [pdfWidth, continuousHeight]);

    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, renderedHeight);
    pdf.save(fileName);

    // Restore original styles
    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
    element.classList.remove('pdf-exporting');
    element.style.width = originalWidth;
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;
    element.style.backgroundColor = originalBackground;

    if (isDark) {
      document.documentElement.classList.add('dark');
    }

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
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    }

    return false;
  }
};

/**
 * Export Full Page Long Screenshot (PNG) - Jadi 1 Gambar Utuh Memanjang ke Bawah
 */
export const exportLongImage = async (element: HTMLElement, fileName: string) => {
  try {
    const elementsToHide = element.querySelectorAll('.no-pdf, .no-screenshot');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#090d16',
      windowWidth: element.scrollWidth,
    });

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
    return true;
  } catch (err) {
    console.error("Error generating image", err);
    showError("Gagal menyimpan gambar.");
    return false;
  }
};
