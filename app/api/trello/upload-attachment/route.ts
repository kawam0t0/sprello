import { NextRequest, NextResponse } from "next/server"
import { uploadTrelloAttachment } from "@/lib/trello-operations"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const trelloCardId = formData.get("trelloCardId") as string

    if (!file || !trelloCardId) {
      return NextResponse.json({ error: "File and Trello card ID are required" }, { status: 400 })
    }

    const result = await uploadTrelloAttachment(trelloCardId, file)

    return NextResponse.json({
      success: true,
      attachmentId: result.id,
      attachmentUrl: result.url,
    })
  } catch (error) {
    console.error("Trello attachment upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload attachment" },
      { status: 500 }
    )
  }
}
