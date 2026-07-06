/** Map Supabase/auth errors to Japanese user-facing messages. */
export function toAuthErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) {
    return 'メールアドレスまたはパスワードが正しくありません';
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'このメールアドレスはすでに登録されています';
  }
  if (message.includes('password should be at least')) {
    return 'パスワードは6文字以上で入力してください';
  }
  if (message.includes('unable to validate email') || message.includes('invalid email')) {
    return 'メールアドレスの形式が正しくありません';
  }
  if (message.includes('email not confirmed')) {
    return 'メールアドレスの確認が完了していません';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return '通信に失敗しました';
  }
  if (message.includes('キャンセル')) {
    return error.message;
  }

  return fallback;
}
