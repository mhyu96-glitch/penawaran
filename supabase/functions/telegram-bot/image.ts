// Helper kompresi dan konversi foto dokumentasi lapangan ke WebP (Supabase Edge Function)
// Mengoptimalkan ukuran data foto agar ringan saat dibuka di peta dan portal publik pelanggan.

export async function convertToWebP(inputBytes: Uint8Array): Promise<{ bytes: Uint8Array; format: 'webp' | 'jpeg' | 'png'; isConverted: boolean }> {
  // 1. Cek apakah sudah dalam format WebP (RIFF....WEBP)
  if (
    inputBytes.length >= 12 &&
    inputBytes[0] === 0x52 && inputBytes[1] === 0x49 && inputBytes[2] === 0x46 && inputBytes[3] === 0x46 &&
    inputBytes[8] === 0x57 && inputBytes[9] === 0x45 && inputBytes[10] === 0x42 && inputBytes[11] === 0x50
  ) {
    return {
      bytes: inputBytes,
      format: 'webp',
      isConverted: true
    };
  }

  // 2. Coba konversi via WASM @jsquash jika modul WebAssembly diizinkan runtime
  try {
    const isPng = inputBytes.length >= 8 && inputBytes[0] === 0x89 && inputBytes[1] === 0x50 && inputBytes[2] === 0x4e && inputBytes[3] === 0x47;
    // @ts-ignore
    const { default: encodeWebp } = await import('https://esm.sh/@jsquash/webp@1.5.0/encode');

    let imgData: any = null;
    if (isPng) {
      try {
        // @ts-ignore
        const { default: decodePng } = await import('https://esm.sh/@jsquash/png@3.1.0/decode');
        imgData = await decodePng(inputBytes);
      } catch {
        // fallback to jpeg decode if png decode failed
      }
    }

    if (!imgData) {
      // @ts-ignore
      const { default: decodeJpeg } = await import('https://esm.sh/@jsquash/jpeg@1.5.0/decode');
      imgData = await decodeJpeg(inputBytes);
    }

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
