export interface MediaReference {
  provider: string | null;
  key: string | null;
  url: string;
}

export interface MediaProvider {
  getPublicUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export const MEDIA_PROVIDER = Symbol('MEDIA_PROVIDER');
