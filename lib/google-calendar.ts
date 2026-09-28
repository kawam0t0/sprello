import crypto from "crypto"

// ============================================================
// Googleカレンダー連携（サービスアカウント＋ドメイン全体の委任）
//
// 会社(Google Workspace)のサービスアカウントに「ドメイン全体の委任」を付与し、
// 各担当者本人になりすまして(impersonate)本人のカレンダーへ終日予定を書き込む。
// これにより、担当者ごとの個別OAuth同意なしに「本人の予定」として登録できる。
//
// 必要な環境変数（Vercel の Environment Variables に設定。鍵はコードに書かない）:
//   GOOGLE_SA_CLIENT_EMAIL … サービスアカウントのメール（xxx@yyy.iam.gserviceaccount.com）
//   GOOGLE_SA_PRIVATE_KEY  … サービスアカウント秘密鍵(PEM)。改行は \n のままでOK
//
// これらが未設定の場合、この連携は「無効」として静かにスキップする（アプリは通常動作）。
// ============================================================

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar"

export function calendarConfigured(): boolean {
  return !!(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY)
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

// サービスアカウントの鍵で署名したJWTを作り、対象ユーザーになりすます access_token を取得
async function getAccessToken(subjectEmail: string): Promise<string> {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL
  // Vercelの環境変数では改行が \n 文字列として入ることが多いので実改行へ戻す
  const privateKey = (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n")
  if (!clientEmail || !privateKey) throw new Error("Google service account env vars are not set")

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claims = {
    iss: clientEmail,
    sub: subjectEmail, // なりすまし対象（担当者本人）
    scope: CAL_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey)
  const assertion = `${signingInput}.${base64url(signature)}`

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) {
    throw new Error(`token error: ${res.status} ${JSON.stringify(json)}`)
  }
  return json.access_token as string
}

// due(YYYY-MM-DD)の翌日を返す（Googleの終日イベントは end.date が排他的なため）
function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function eventBody(summary: string, ymd: string, todoId: string) {
  return {
    summary,
    start: { date: ymd },
    end: { date: nextDay(ymd) },
    transparency: "transparent", // 予定を「空き時間」扱いにする（終日の予定でも他予定を圧迫しない）
    extendedProperties: { private: { sprelloTodoId: todoId } },
  }
}

const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars"

// 終日予定を新規作成。作成したイベントIDを返す。
export async function createAllDayEvent(args: {
  calendarEmail: string
  summary: string
  ymd: string
  todoId: string
}): Promise<string> {
  const token = await getAccessToken(args.calendarEmail)
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(args.calendarEmail)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(args.summary, args.ymd, args.todoId)),
  })
  const json = await res.json()
  if (!res.ok || !json.id) throw new Error(`create error: ${res.status} ${JSON.stringify(json)}`)
  return json.id as string
}

// 既存の終日予定を更新（日付・タイトル）。
export async function updateAllDayEvent(args: {
  calendarEmail: string
  eventId: string
  summary: string
  ymd: string
  todoId: string
}): Promise<void> {
  const token = await getAccessToken(args.calendarEmail)
  const res = await fetch(
    `${CAL_BASE}/${encodeURIComponent(args.calendarEmail)}/events/${encodeURIComponent(args.eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(args.summary, args.ymd, args.todoId)),
    },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`update error: ${res.status} ${t}`)
  }
}

// 予定を削除（すでに無い場合＝404/410は成功扱い）。
export async function deleteEvent(args: { calendarEmail: string; eventId: string }): Promise<void> {
  const token = await getAccessToken(args.calendarEmail)
  const res = await fetch(
    `${CAL_BASE}/${encodeURIComponent(args.calendarEmail)}/events/${encodeURIComponent(args.eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const t = await res.text()
    throw new Error(`delete error: ${res.status} ${t}`)
  }
}
