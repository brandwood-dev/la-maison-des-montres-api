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
