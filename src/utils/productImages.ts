// Utilitários puros do cadastro de produto: slug e compressão de imagens no navegador.

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || `produto-${Date.now()}`;

// Redimensiona e converte para WebP — muito mais leve que JPEG para o mesmo tamanho.
// 2560px/q0.95: o dobro do maior render do site (carrossel, 1400px), o que cobre
// telas retina. Acima disso paga-se banda por pixel que nenhuma tela mostra.
// NUNCA faz upscale — uma origem de 600px continua com 600px, e é por isso que
// a resolução do arquivo de origem é o teto real da qualidade final.
export function fileToCompressedDataURL(file: File, maxSize = 2560, quality = 0.95): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, width, height);
        // WebP é ~30% menor que JPEG com qualidade equivalente
        const webp = canvas.toDataURL('image/webp', quality);
        // Fallback para JPEG se o browser não suportar WebP (raro em 2025)
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Thumbnail em HD — 1600px cobre os cards de lista em telas retina.
export function fileToThumbnailDataURL(file: File): Promise<string> {
  return fileToCompressedDataURL(file, 1600, 0.95);
}

// Baixa uma imagem por URL e converte para WebP comprimido via canvas.
// Usada para imagens externas (Yahoo/Rakuten) que chegam em resolução full.
// Atenção: se o fornecedor devolver a miniatura em vez da foto grande, o produto
// nasce com master pequena e nenhuma transformação de entrega recupera detalhe.
export function urlToCompressedDataURL(url: string, maxSize = 2560, quality = 0.95): Promise<string> {
  return new Promise((resolve) => {
    // Timeout de 8s: se CORS ou rede travar, cai no fallback com a URL original
    const timer = setTimeout(() => resolve(url), 8000);
    const done = (result: string) => { clearTimeout(timer); resolve(result); };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { done(url); return; }
      try {
        ctx.drawImage(img, 0, 0, width, height);
        const webp = canvas.toDataURL('image/webp', quality);
        done(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality));
      } catch {
        // Canvas tainted por CORS — devolve a URL original
        done(url);
      }
    };
    img.onerror = () => done(url);
    img.src = url;
  });
}
