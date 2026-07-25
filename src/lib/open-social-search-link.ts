/**
 * Open external social / web search URLs safely (no red screens).
 */

import { Linking } from 'react-native';

import {
  assertSafeExternalUrl,
  buildSocialWebSearchFallbackUrl,
  type SocialLinkType,
} from '@/lib/place-preview-links';

/**
 * Prefer the network URL (often hands off to the app on iOS); fall back to Google web search.
 */
export async function openSocialSearchLink(params: {
  type: SocialLinkType;
  query: string;
  primaryUrl: string;
}): Promise<boolean> {
  const primary = assertSafeExternalUrl(params.primaryUrl);
  const fallback = buildSocialWebSearchFallbackUrl(params.query, params.type);

  if (!primary && !fallback) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[social-link]', {
        socialLinkType: params.type,
        hasSafeSocialQuery: false,
        invalidExternalLinkBlocked: true,
        externalLinkOpened: false,
      });
    }
    return false;
  }

  const candidates = [primary, fallback].filter(Boolean) as string[];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      if (process.env.NODE_ENV !== 'production') {
        console.info('[social-link]', {
          socialLinkType: params.type,
          hasSafeSocialQuery: true,
          externalLinkOpened: true,
          usedFallback: url === fallback && url !== primary,
        });
      }
      return true;
    } catch {
      // try next candidate
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[social-link]', {
      socialLinkType: params.type,
      hasSafeSocialQuery: true,
      externalLinkOpened: false,
    });
  }
  return false;
}
