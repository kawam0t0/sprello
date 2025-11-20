import { type NextRequest, NextResponse } from "next/server"
import { createTrelloList, createTrelloCard } from "@/lib/trello-operations"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Trello API route called")

    const { projectName } = await request.json()
    console.log("[v0] Request data:", { projectName })

    if (!projectName) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 })
    }

    console.log("[v0] Environment check:", {
      hasApiKey: !!process.env.TRELLO_API_KEY,
      hasTrelloToken: !!process.env.TRELLO_TOKEN,
      hasBoardId: !!process.env.TRELLO_BOARD_ID,
    })

    console.log("[v0] Creating Trello list...")
    const trelloListId = await createTrelloList(projectName)
    console.log("[v0] Trello list created:", trelloListId)

    console.log("[v0] Creating default contract card...")
    const contractCardId = await createTrelloCard(trelloListId, {
      title: "契約書作成",
    })
    console.log("[v0] Contract card created:", contractCardId)

    return NextResponse.json({
      success: true,
      trelloListId,
      contractCardId,
    })
  } catch (error) {
    console.error("[v0] Trello list creation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Trello list" },
      { status: 500 },
    )
  }
}
