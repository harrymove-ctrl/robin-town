const shops = ['coffee', 'banhmi', 'pho', 'flowers', 'tailor', 'grocery'];
const districts = ['tan-dinh', 'ben-thanh', 'thao-dien', 'cho-lon', 'binh-thanh', 'phu-nhuan'];

export const GAME_IMAGES: string[] = [
  '/assets/saigon/city/saigon-city-board-v6.png',
  ...shops.map((name) => `/assets/saigon/shops/${name}.png`),
  ...[0, 1, 2, 3].map((id) => `/assets/saigon/materials/stool-${id}-v8.png`),
  ...districts.map((name) => `/assets/saigon/signs/${name}-v6.png`),
  '/assets/saigon/materials/plot-ground.png',
  ...['chieu-mat-v9', 'plot-mini-v9', 'calendar-paper-v9'].map(
    (name) => `/assets/saigon/ui/${name}.png`,
  ),
  ...['ninja-lead', 'city-bus', 'pedestrian-walk', 'game-banknote'].map(
    (name) => `/assets/saigon/life/${name}.png`,
  ),
  '/assets/wif-coin.png',
];

export type PreloadProgress = (completed: number, total: number) => void;
export type PreloadImageListener = (event: Event) => unknown;

/** Only the image surface needed for warming; native Image and small fakes both fit. */
export interface PreloadImage {
  src: string;
  onload: PreloadImageListener | null;
  onerror: PreloadImageListener | null;
  decode?: () => Promise<unknown>;
}

export interface PreloadImageConstructor {
  new (): PreloadImage;
}

export interface PreloadResult {
  failed: string[];
  total: number;
}

const decoded = new Map<string, PreloadImage>();

export async function preloadGameImages(
  onProgress: PreloadProgress = () => {},
  ImageType: PreloadImageConstructor = globalThis.Image,
): Promise<PreloadResult> {
  let completed = 0;
  const failed: string[] = [];
  await Promise.all(
    GAME_IMAGES.map(
      (src) =>
        new Promise<void>((resolve) => {
          if (decoded.has(src)) {
            onProgress(++completed, GAME_IMAGES.length);
            resolve();
            return;
          }
          const image = new ImageType();
          let settled = false;
          const finish = (ok: boolean): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            image.onload = image.onerror = null;
            if (ok) decoded.set(src, image);
            else failed.push(src);
            onProgress(++completed, GAME_IMAGES.length);
            resolve();
          };
          const timeout = setTimeout(() => finish(false), 12000);
          image.onload = () => {
            if (image.decode)
              image.decode().then(
                () => finish(true),
                () => finish(true),
              );
            else finish(true);
          };
          image.onerror = () => finish(false);
          image.src = src;
        }),
    ),
  );
  return { failed, total: GAME_IMAGES.length };
}
