import * as AppleAuthentication from 'expo-apple-authentication';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { User } from '@supabase/supabase-js';

import { getSupabase, isSupabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: 'nanisuru',
  path: 'auth/callback',
});

async function createSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(`認証エラー: ${errorCode}`);
  }

  const { access_token, refresh_token, code } = params;
  const supabase = getSupabase();

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  throw new Error('認証セッションの取得に失敗しました');
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
