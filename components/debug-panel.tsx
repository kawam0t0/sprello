"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

export function DebugPanel() {
  const [connectionStatus, setConnectionStatus] = useState<string>("未確認")
  const [boardData, setBoardData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testConnection = async () => {
    try {
      setConnectionStatus("接続中...")

      // Supabase接続テスト
      const { data, error } = await supabase.from("boards").select("*").limit(1)

      if (error) {
        setConnectionStatus("接続エラー")
        setError(error.message)
        return
      }

      setConnectionStatus("接続成功")
      setBoardData(data)
      setError(null)
    } catch (err) {
      setConnectionStatus("接続失敗")
      setError(err instanceof Error ? err.message : "不明なエラー")
    }
  }

  const testEnvironmentVariables = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log("環境変数チェック:")
    console.log("SUPABASE_URL:", supabaseUrl ? "設定済み" : "未設定")
    console.log("SUPABASE_ANON_KEY:", supabaseKey ? "設定済み" : "未設定")

    if (supabaseUrl) {
      console.log("URL:", supabaseUrl.substring(0, 30) + "...")
    }
    if (supabaseKey) {
      console.log("KEY:", supabaseKey.substring(0, 30) + "...")
    }
  }

  return (
    <Card className="p-4 m-4 bg-blue-50">
      <h3 className="text-lg font-bold mb-4">🔧 Supabase接続デバッグ</h3>

      <div className="space-y-4">
        <div>
          <Button onClick={testConnection} className="mr-2">
            接続テスト
          </Button>
          <Button onClick={testEnvironmentVariables} variant="outline">
            環境変数チェック
          </Button>
        </div>

        <div>
          <strong>接続状態:</strong> {connectionStatus}
        </div>

        {error && (
          <div className="text-red-600">
            <strong>エラー:</strong> {error}
          </div>
        )}

        {boardData && (
          <div>
            <strong>取得データ:</strong>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">{JSON.stringify(boardData, null, 2)}</pre>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p>• ブラウザのコンソール（F12）も確認してください</p>
          <p>• 環境変数は本番環境で正しく設定されていますか？</p>
        </div>
      </div>
    </Card>
  )
}
