import * as AppleAuthentication from 'expo-apple-authentication';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabase, isSupabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: 'nanisuru',
  path: 'auth/callback',
});

const SESSION_WAIT_MS = 5000;
const SESSION_POLL_MS = 200;

function oauthParamsPresent(url: string): boolean {
  return (
    url.includes('access_token=') ||
    url.includes('refresh_token=') ||
    url.includes('code=') ||
    url.includes('error=') ||
    url.includes('error_description=')
  );
}

/** Web OAuth redirect URL (includes hash fragment tokens). */
export function getWebOAuthCallbackUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  return window.location.href;
}

/** Parse OAuth callback URL — supports `#access_token=...` and `?code=...`. */
export async function restoreSessionFromOAuthUrl(url: string): Promise<boolean> {
  if (!url.trim() || !oauthParamsPresent(url)) {
    return false;
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(`認証エラー: ${errorCode}`);
  }

  const accessToken = params.access_token ?? params.accessToken;
  const refreshToken = params.refresh_token ?? params.refreshToken;
  const code = params.code;
  const supabase = getSupabase();

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return true;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  return false;
}

async function createSessionFromUrl(url: string): Promise<void> {
  const restored = await restoreSessionFromOAuthUrl(url);
  if (!restored) {
    throw new Error('認証セッションの取得に失敗しました');
  }
}

/** Wait for Supabase to persist and expose a session after OAuth redirect. */
export async function waitForAuthSession(timeoutMs = SESSION_WAIT_MS): Promise<Session | null> {
  const supabase = getSupabase();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, SESSION_POLL_MS));
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/** Resolve OAuth callback from deep link and/or current web URL. */
export async function completeOAuthCallback(initialUrl?: string | null): Promise<Session | null> {
  const candidateUrls = [initialUrl, getWebOAuthCallbackUrl()].filter(
    (url): url is string => Boolean(url?.trim()),
  );

  let lastError: unknown = null;
  for (const url of candidateUrls) {
    try {
      if (await restoreSessionFromOAuthUrl(url)) {
        break;
      }
    } catch (error) {
      lastError = error;
      console.warn('[auth] OAuth callback URL の処理に失敗しました:', error);
    }
  }

  const session = await waitForAuthSession();
  if (session) return session;

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error('ログインに失敗しました。もう一度お試しください。');
  }

  return null;
}

export function clearWebOAuthCallbackUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!oauthParamsPresent(window.location.href)) return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabaseが設定されていません。\n.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してください。',
    );
  }
}

export async function signInWithGoogle(): Promise<void> {
  assertSupabaseConfigured();
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Googleログインを開始できませんでした');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('ログインがキャンセルされました');
  }

  await createSessionFromUrl(result.url);
}

export async function signInWithApple(): Promise<void> {
  assertSupabaseConfigured();
  const supabase = getSupabase();

  if (Platform.OS === 'ios') {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('この端末ではAppleログインを利用できません');
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple認証トークンの取得に失敗しました');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;

      if (credential.fullName) {
        const givenName = credential.fullName.givenName ?? '';
        const familyName = credential.fullName.familyName ?? '';
        const fullName = [familyName, givenName].filter(Boolean).join(' ');

        if (fullName && !data.user?.user_metadata?.full_name) {
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          });
        }
      }

      return;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      ) {
        throw new Error('ログインがキャンセルされました');
      }
      throw error;
    }
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Appleログインを開始できませんでした');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('ログインがキャンセルされました');
  }

  await createSessionFromUrl(result.url);
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export function getUserDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  return (
    metadata.full_name ??
    metadata.name ??
    user.email?.split('@')[0] ??
    'Nanisuruユーザー'
  );
}

export function getAuthProviderLabel(user: User): string {
  const provider = user.app_metadata?.provider;
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  return 'ソーシャルログイン';
}

export function getUserInitial(user: User): string {
  const name = getUserDisplayName(user);
  return name.charAt(0).toUpperCase();
}
