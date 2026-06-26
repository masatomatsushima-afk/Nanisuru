export type BetaFeedbackInput = {
  rating: number;
  easeOfUse: string;
  confusingPoints: string;
  wouldUseAgain: string;
  wouldRecommend: string;
  requestedFeatures: string;
  bugReport: string;
};

export type BetaFeedback = BetaFeedbackInput & {
  id: string;
  userId: string;
  createdAt: string;
};

export const BETA_TEST_SHARE_MESSAGE =
  'NanisuruっていうAIおでかけアプリを作ってます。少し触って感想もらえたら嬉しいです！';

export const BETA_TEST_CHECKLIST = [
  { id: 'create_plan', label: 'プランを作成する', hint: 'ホームタブでAIプランを生成' },
  { id: 'verify_places', label: '実在スポットを確認する', hint: '行程にGoogle Placesのスポット名があるか確認' },
  { id: 'open_maps', label: 'Google Mapsで開く', hint: 'スポットから地図を開く' },
  { id: 'directions', label: '現在地から道案内する', hint: '道案内ボタンを試す' },
  { id: 'save_plan', label: 'プランを保存する', hint: '生成後に「プランを保存」' },
  { id: 'publish_plan', label: 'プランを公開する', hint: '保存済みプランから公開' },
  { id: 'discover_tab', label: '発見タブを見る', hint: 'みんなの公開プランをチェック' },
  { id: 'save_public', label: '他のプランを保存する', hint: '公開プランをマイプランに保存' },
  { id: 'copy_edit', label: 'プランをコピーして編集する', hint: '公開プランをベースにカスタム' },
  { id: 'social', label: 'コメント・いいねを試す', hint: 'いいね・コメント・フォロー' },
] as const;

export type BetaTestChecklistId = (typeof BETA_TEST_CHECKLIST)[number]['id'];
