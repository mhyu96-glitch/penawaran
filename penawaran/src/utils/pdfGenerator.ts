import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { showError } from '@/utils/toast';

export const generatePdf = async (element: HTMLElement, fileName: string) => {
  try {
    // Save original styles
    const originalWidth = element.style.width;
    const originalHeight = element.style.height;
    const originalOverflow = element.style.overflow;

    // Force A4 dimensions (794px is roughly A4 width at 96 DPI)
    element.style.width = '794px';
    element.style.height = 'auto';
    element.style.overflow = 'visible';

    // Hide elements marked with .no-pdf class
    const elementsToHide = element.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');

    // Wait a brief moment for DOM layout updates
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // Allow loading cross-origin images (like Supabase storage logos)
      logging: false,
      windowWidth: 794
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Add subsequent pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName);

    // Restore original styles
    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
    element.style.width = originalWidth;
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;

    return true;
  } catch (err) {
    console.error("Error generating PDF", err);
    showError("Gagal membuat PDF. Pastikan gambar sudah termuat sepenuhnya.");
    
    // Restore styles in case of error
    const elementsToHide = element.querySelectorAll('.no-pdf');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
    element.style.width = originalWidth;
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;
    
    return false;
  }
};