// PJT進捗の担当者 → Googleカレンダー書き込み先（本人のメール＝カレンダーID）の対応表。
// PJT進捗で日付を入れると、その項目の担当者「本人」のカレンダーへ終日予定として同期する。
// 名前を変えたり担当者を増やしたときは、ここと lib/pjt-todo-template.ts の
// PJT_ASSIGNEES、components/pjt-progress-view.tsx の ASSIGNEE_COLORS を合わせて更新すること。
export const ASSIGNEE_EMAILS: Record<string, string> = {
  岡村: "mokamura@splashbrothers.co.jp",
  ラメザニ: "raidien@splashbrothers.co.jp",
  霜田: "hshimoda@splashbrothers.co.jp",
  大野: "aoono@splashbrothers.co.jp",
  小川: "togawa@splashbrothers.co.jp",
  河本: "skawamoto@splashbrothers.co.jp",
  後藤: "rgoto@splashbrothers.co.jp",
}

export function assigneeEmail(assignee: string | null | undefined): string | null {
  if (!assignee) return null
  return ASSIGNEE_EMAILS[assignee] ?? null
}
