export async function compressImage(
  file: File,
  maxDimension = 800,
  quality = 0.7,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    // Timeout to catch mobile cases where the image silently fails to decode
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Image processing timed out — the photo may be too large'));
    }, 15_000);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);

      try {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not create canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'));
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve({
                base64: (reader.result as string).split(',')[1]!,
                mimeType: 'image/jpeg',
              });
            reader.onerror = () => reject(new Error('Failed to read compressed image'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality,
        );
      } catch (err) {
        reject(new Error(`Image compression error: ${(err as Error).message}`));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load the photo (format: ${file.type || 'unknown'})`));
    };
    img.src = url;
  });
}

