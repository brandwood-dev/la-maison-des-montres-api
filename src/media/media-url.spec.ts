import { publicImageVariants } from './media-url';

describe('publicImageVariants', () => {
  it('builds responsive Supabase transformation URLs', () => {
    const variants = publicImageVariants(
      'https://project.supabase.co/storage/v1/object/public/product-media/products/watch.jpg',
    );

    expect(variants?.optimizedUrl).toBe(
      'https://project.supabase.co/storage/v1/render/image/public/product-media/products/watch.jpg?width=960&quality=80',
    );
    expect(variants?.srcSet).toContain('width=320&quality=80 320w');
    expect(variants?.srcSet).toContain('width=1600&quality=80 1600w');
    expect(variants?.cardUrl).toBe(
      'https://project.supabase.co/storage/v1/render/image/public/product-media/products/watch.jpg?width=640&height=800&resize=cover&quality=80',
    );
    expect(variants?.cardSrcSet).toContain(
      'width=320&height=400&resize=cover&quality=80 320w',
    );
    expect(variants?.thumbnailUrl).toBe(
      'https://project.supabase.co/storage/v1/render/image/public/product-media/products/watch.jpg?width=160&height=160&resize=cover&quality=80',
    );
    expect(variants?.thumbnailSrcSet).toContain(
      'width=80&height=80&resize=cover&quality=80 80w',
    );
  });

  it('leaves external and already transformed URLs untouched', () => {
    expect(
      publicImageVariants(
        'https://res.cloudinary.com/demo/image/upload/watch.jpg',
      ),
    ).toBeNull();
    expect(
      publicImageVariants(
        'https://project.supabase.co/storage/v1/render/image/public/product-media/products/watch.jpg?width=640',
      ),
    ).toBeNull();
  });
});
