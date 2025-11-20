// Trello API操作用のユーティリティ関数

const TRELLO_API_BASE = "https://api.trello.com/1"

// Trello APIリクエストの共通ヘルパー
async function trelloRequest(endpoint: string, method: string = "GET", body?: any) {
  const apiKey = process.env.TRELLO_API_KEY
  const token = process.env.TRELLO_TOKEN

  if (!apiKey || !token) {
    throw new Error("Trello API credentials are not configured")
  }

  const url = new URL(`${TRELLO_API_BASE}${endpoint}`)
  url.searchParams.append("key", apiKey)
  url.searchParams.append("token", token)

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  }

  if (body && method !== "GET") {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url.toString(), options)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Trello API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// カード作成時にTrelloリストを作成
export async function createTrelloList(projectName: string): Promise<string> {
  const boardId = process.env.TRELLO_BOARD_ID

  if (!boardId) {
    throw new Error("Trello Board ID is not configured")
  }

  const data = await trelloRequest(`/lists`, "POST", {
    name: projectName,
    idBoard: boardId,
    pos: "bottom",
  })

  return data.id
}

// Trelloリストの名前を更新
export async function updateTrelloListName(listId: string, newName: string): Promise<void> {
  await trelloRequest(`/lists/${listId}`, "PUT", {
    name: newName,
  })
}

// Trelloリストを削除（アーカイブ）
export async function archiveTrelloList(listId: string): Promise<void> {
  await trelloRequest(`/lists/${listId}/closed`, "PUT", {
    value: true,
  })
}

// Trelloカードに添付ファイルをアップロード
export async function uploadTrelloAttachment(
  cardId: string,
  file: File
): Promise<{ id: string; url: string }> {
  const apiKey = process.env.TRELLO_API_KEY
  const token = process.env.TRELLO_TOKEN

  if (!apiKey || !token) {
    throw new Error("Trello API credentials are not configured")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("name", file.name)

  const url = new URL(`${TRELLO_API_BASE}/cards/${cardId}/attachments`)
  url.searchParams.append("key", apiKey)
  url.searchParams.append("token", token)

  const response = await fetch(url.toString(), {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Trello attachment upload error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// Trelloカードの添付ファイルを削除
export async function deleteTrelloAttachment(cardId: string, attachmentId: string): Promise<void> {
  await trelloRequest(`/cards/${cardId}/attachments/${attachmentId}`, "DELETE")
}

// Trelloカードの添付ファイル一覧を取得
export async function getTrelloAttachments(cardId: string): Promise<any[]> {
  return await trelloRequest(`/cards/${cardId}/attachments`, "GET")
}

// Trelloリスト内にタスクカードを作成（プロジェクト情報用）
export async function createTrelloCard(
  listId: string,
  cardData: {
    title: string
    description?: string
    dueDate?: string
  }
): Promise<string> {
  const data = await trelloRequest(`/cards`, "POST", {
    idList: listId,
    name: cardData.title,
    desc: cardData.description || "",
    due: cardData.dueDate || null,
    pos: "bottom",
  })

  return data.id
}

// Trelloカードを更新
export async function updateTrelloCard(
  cardId: string,
  updates: {
    name?: string
    desc?: string
    due?: string
  }
): Promise<void> {
  await trelloRequest(`/cards/${cardId}`, "PUT", updates)
}
