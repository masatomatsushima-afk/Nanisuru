import { AppErrorBanner } from '@/components/app-error-banner';

type PlacesNoticeBannerProps = {
  message: string;
};

export function PlacesNoticeBanner({ message }: PlacesNoticeBannerProps) {
  return <AppErrorBanner message={message} variant="warning" />;
}
