export const PUBLIC_PLAN_VIDEO_MAX_COUNT = 3;

export const INVALID_VIDEO_URL_MESSAGE = '有効な動画リンクを入力してください';

export type VideoPlatform = 'Instagram' | 'TikTok' | 'YouTube';

export type PublicPlanVideo = {
  id: string;
  publicPlanId: string;
  videoUrl: string;
  platform: VideoPlatform;
  orderIndex: number;
  createdAt: string;
};

export type PublishPlanVideoDraft = {
  key: string;
  videoUrl: string;
  platform: VideoPlatform;
  orderIndex: number;
};

export function getVideoPlatformButtonLabel(platform: VideoPlatform): string {
  switch (platform) {
    case 'Instagram':
      return 'Instagram動画を見る';
    case 'TikTok':
      return 'TikTokで見る';
    case 'YouTube':
      return 'YouTubeで見る';
  }
}

export function getVideoPlatformIcon(platform: VideoPlatform): string {
  switch (platform) {
    case 'Instagram':
      return '📷';
    case 'TikTok':
      return '🎵';
    case 'YouTube':
      return '▶️';
  }
}
