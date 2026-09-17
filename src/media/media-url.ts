const STORAGE_PUBLIC_MARKER = '/storage/v1/object/public/';
const STORAGE_RENDER_MARKER = '/storage/v1/render/image/public/';
const IMAGE_WIDTHS = [320, 640, 960, 1280, 1600] as const;
const CARD_WIDTHS = [320, 480, 640, 960] as const;
const THUMB_WIDTHS = [80, 120, 160] as const;
const IMAGE_QUALITY = 80;

export type PublicImageVariants = {
  optimizedUrl: string;
  srcSet: string;
  sizes: string;
  /** Canonical 4/5 crop used by catalogue cards. */
  cardUrl: string;
  cardSrcSet: string;
  cardSizes: string;
  /** Square crop used by product-gallery thumbnails. */
  thumbnailUrl: string;
  thumbnailSrcSet: string;
  thumbnailSizes: string;
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
  const transformedBox = (
    width: number,
    height: number,
    resize: 'cover' | 'contain',
  ) =>
    `${base}?width=${width}&height=${height}&resize=${resize}&quality=${IMAGE_QUALITY}`;

  return {
    optimizedUrl: transformed(960),
    srcSet: IMAGE_WIDTHS.map((width) => `${transformed(width)} ${width}w`).join(
      ', ',
    ),
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw',
    cardUrl: transformedBox(640, 800, 'cover'),
    cardSrcSet: CARD_WIDTHS.map(
      (width) =>
        `${transformedBox(width, Math.round(width * 1.25), 'cover')} ${width}w`,
    ).join(', '),
    cardSizes: '(max-width: 480px) 85vw, (max-width: 1024px) 48vw, 25vw',
    thumbnailUrl: transformedBox(160, 160, 'cover'),
    thumbnailSrcSet: THUMB_WIDTHS.map(
      (width) => `${transformedBox(width, width, 'cover')} ${width}w`,
    ).join(', '),
    thumbnailSizes: '80px',
  };
}
