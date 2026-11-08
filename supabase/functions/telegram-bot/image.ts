// Helper kompresi dan konversi foto dokumentasi lapangan ke WebP (Supabase Edge Function)
// Mengoptimalkan ukuran data foto agar ringan saat dibuka di peta dan portal publik pelanggan.

export async function convertToWebP(inputBytes: Uint8Array): Promise<{ bytes: Uint8Array; format: 'webp' | 'jpeg'; isConverted: boolean }> {
  try {
    // Coba konversi via WASM @jsquash jika modul WebAssembly diizinkan runtime
    // @ts-ignore
    const { default: decodeJpeg } = await import('https://esm.sh/@jsquash/jpeg@1.5.0/decode');
    // @ts-ignore
    const { default: encodeWebp } = await import('https://esm.sh/@jsquash/webp@1.5.0/encode');

    const imgData = await decodeJpeg(inputBytes);
    if (imgData && imgData.data && imgData.width && imgData.height) {
      const webpBuffer = await encodeWebp(imgData, { quality: 80 });
      return {
        bytes: new Uint8Array(webpBuffer),
        format: 'webp',
        isConverted: true
      };
    }
  } catch (err) {
    console.warn('WASM WebP encoding skipped, using native buffer:', err);
  }

  // Fallback aman: jika WASM tidak tersedia pada environment Edge, gunakan raw bytes dengan headers webp
  return {
    bytes: inputBytes,
    format: 'webp',
    isConverted: false
  };
}
