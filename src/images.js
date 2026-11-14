function tryLoad(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadSingleImage(basePath) {
  const exts = ['.png', '.jpg', '.webp'];
  for (const ext of exts) {
    const img = await tryLoad(basePath + ext);
    if (img) {
      return img;
    }
  }
  return null;
}

export async function loadImages(manifest) {
  const images = {};
  if (!manifest) return images;

  const entries = Object.entries(manifest);
  await Promise.all(
    entries.map(async ([key, basePath]) => {
      images[key] = await loadSingleImage(basePath);
    })
  );

  return images;
}
