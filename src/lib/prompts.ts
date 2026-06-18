export type PlanInput = {
  location: string;
  budget: string;
  people: string;
  relationship: string;
  mood: string;
};

export function buildConciergePrompt(input: PlanInput): string {
  const location = input.location.trim() || '未指定';
  const budget = input.budget.trim() || '未指定';
  const people = input.people.trim() || '未指定';
  const mood = input.mood.trim() || '未指定';

  return `あなたは世界最高のお出かけコンシェルジュです。

条件

場所: ${location}
予算: ${budget}
人数: ${people}
関係性: ${input.relationship}
気分: ${mood}

ユーザーに最適な1日のプランを日本語で作成してください。

時間ごとに分けてください。
予算内に収めてください。
移動が不自然にならないようにしてください。

必ず以下のJSON形式のみで回答してください。余計な文章は含めないでください。
{
  "items": [
    { "time": "10:00", "activity": "具体的なスポット名・アクティビティ" }
  ],
  "totalBudget": "合計予算の目安（日本語）",
  "duration": "所要時間（日本語、例：約8時間）",
  "highlights": ["おすすめポイント1", "おすすめポイント2", "おすすめポイント3"],
  "rainyDayAlternatives": ["雨の日の代替案1", "雨の日の代替案2", "雨の日の代替案3"]
}

itemsは4〜6件、timeは"HH:MM"形式、activityは日本語で具体的に書いてください。`;
}
