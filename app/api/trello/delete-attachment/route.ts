import { NextRequest, NextResponse } from "next/server"
import { deleteTrelloAttachment } from "@/lib/trello-operations"

export async function POST(request: NextRequest) {
  try {
    const { trelloCardId, attachmentId } = await request.json()

    if (!trelloCardId || !attachmentId) {
      return NextResponse.json(
        { error: "Trello card ID and attachment ID are required" },
        { status: 400 }
      )
    }

    await deleteTrelloAttachment(trelloCardId, attachmentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Trello attachment deletion error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete attachment" },
      { status: 500 }
    )
  }
}
