const STORAGE_PUBLIC_MARKER = '/storage/v1/object/public/';
const STORAGE_RENDER_MARKER = '/storage/v1/render/image/public/';
const IMAGE_WIDTHS = [320, 640, 960, 1280, 1600] as const;
const IMAGE_QUALITY = 80;

export type PublicImageVariants = {
  optimizedUrl: string;
  srcSet: string;
  sizes: string;
};

/**
 * Builds Supabase Image Transformation URLs without exposing any credentials.
 * Non-Supabase URLs (Cloudinary, external CDN, etc.) are left untouched so
 * legacy catalogue media continues to work.
 */
export function publicImageVariants(value: string): PublicImageVariants | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const markerIndex = parsed.pathname.indexOf(STORAGE_PUBLIC_MARKER);
  if (markerIndex < 0 || parsed.pathname.includes(STORAGE_RENDER_MARKER)) {
    return null;
  }

  const storagePath = parsed.pathname.slice(
    markerIndex + STORAGE_PUBLIC_MARKER.length,
  );
  if (!storagePath) return null;

  const base = `${parsed.origin}${STORAGE_RENDER_MARKER}${storagePath}`;
  const transformed = (width: number) =>
    `${base}?width=${width}&quality=${IMAGE_QUALITY}`;

  return {
    optimizedUrl: transformed(960),
    srcSet: IMAGE_WIDTHS.map((width) => `${transformed(width)} ${width}w`).join(
      ', ',
    ),
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
  };
}
