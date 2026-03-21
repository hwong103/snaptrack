export async function compressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.82,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve({
              base64: (reader.result as string).split(',')[1]!,
              mimeType: 'image/jpeg',
            });
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}
