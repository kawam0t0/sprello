// PJT進捗のTODO初期テンプレート（契約済以降に実施する項目）
// 各プロジェクトを初めて開いたとき、このテンプレートを「独立したコピー」として
// そのプロジェクト専用に複製する（チェック状態はプロジェクトごとに独立）。

// 担当プルダウンの選択肢（デフォルト）
export const PJT_ASSIGNEES = ["岡村", "ラメザニ", "霜田", "大野", "小川", "河本"] as const

export type TodoSeed = {
  title: string
  assignee?: string
  memo?: string
  children?: TodoSeed[]
}

export const PJT_TODO_TEMPLATE: TodoSeed[] = [
  {
    title: "OPEN日を決める",
    assignee: "岡村",
    children: [
      { title: "OPEN看板の設置" },
      { title: "電光掲示板の設置" },
      { title: "infomation/マップのアップ(ホームページ)" },
      { title: "LPの作成" },
      { title: "店舗ポスターの作成/設置" },
      { title: "トレーラー納品日決定" },
    ],
  },
  {
    title: "キャンペーン&プロモーションを決める",
    assignee: "岡村",
    children: [
      {
        title: "キャンペーン",
        children: [
          { title: "キャンペーン内容の決定" },
          { title: "キャンペーンの社内スケジュール確認" },
        ],
      },
      {
        title: "プロモーション",
        children: [
          { title: "インスタ開設" },
          { title: "インスタ広告" },
          { title: "インフルエンサーの選定" },
          { title: "インフルエンサーとの打合せ" },
          { title: "インフルエンサーの撮影" },
        ],
      },
      { title: "PRTimes" },
      { title: "チラシデザイン/部数の決定/発注" },
      { title: "地元メディア掲載" },
      { title: "群ラボ" },
    ],
  },
  {
    title: "システムを整える",
    assignee: "河本",
    children: [
      {
        title: "Googleアカウント",
        children: [{ title: "Googleアカウント開設" }, { title: "Googleアカウント共有" }],
      },
      {
        title: "DialPad",
        children: [{ title: "申請" }, { title: "発番" }],
      },
      {
        title: "Squareアカウント",
        children: [
          { title: "開設" },
          { title: "商品登録" },
          { title: "キャッシュレス申請" },
          { title: "ターミナル周辺機器購入" },
        ],
      },
      {
        title: "GoogleMap",
        children: [{ title: "申請" }, { title: "開設" }, { title: "設定" }],
      },
      {
        title: "Airshift",
        children: [{ title: "アカウント開設" }],
      },
      {
        title: "備品購入",
        children: [
          { title: "店舗PC" },
          { title: "GL-Net" },
          { title: "ラベルプリンター" },
          { title: "ライブカメラ" },
          { title: "LANケーブル" },
        ],
      },
      {
        title: "光回線の契約",
        children: [{ title: "申請" }, { title: "工事日決定" }, { title: "開通" }],
      },
      {
        title: "店舗インフラ開発",
        children: [
          { title: "店舗スプレッドシート" },
          { title: "Googlechat開設/通知" },
          { title: "ONEAPP(店舗情報)" },
          { title: "Kawazon(店舗情報)" },
          { title: "MF請求書店舗追加" },
          { title: "ラベルプリント印刷(入会/ONEAPP)" },
          { title: "ライブ配信カメラ(GL-Net接続)" },
        ],
      },
      { title: "店舗聞き取りForm" },
    ],
  },
  {
    title: "研修を決める",
    children: [
      { title: "研修の日程の決定" },
      { title: "社員採用？バイト運営？" },
    ],
  },
  {
    title: "採用を決める",
    children: [
      { title: "採用ページに掲載する取材対応" },
      { title: "indeed採用ページ" },
      { title: "面接" },
      { title: "採用" },
      { title: "OJT" },
    ],
  },
  {
    title: "店舗運営備品を買う",
    children: [
      {
        title: "ハイロック販促物",
        children: [
          { title: "タオル用パネル" },
          { title: "出口信号用パネル" },
          { title: "マットクリーナー用ステッカー" },
          { title: "マットクリーナー用ロゴステッカー" },
          { title: "上記4件送料" },
          { title: "利用規約" },
          { title: "洗車パス" },
          { title: "料金看板" },
          { title: "利用規約看板" },
          { title: "コース用ステッカー" },
          { title: "アパレル" },
          { title: "チラシ" },
          { title: "のぼり&ポール、中水台" },
          { title: "IN看板" },
          { title: "スタッフルーム カッティングシート" },
        ],
      },
      {
        title: "リアル販促物",
        memo: "https://docs.google.com/spreadsheets/d/1Axw-xl56HQuPugajb4F3sNAN6htw7PinSxVvCpACmZA/edit?usp=sharing",
      },
    ],
  },
  {
    title: "スタッフを管理する",
    children: [
      { title: "スタッフOJT" },
      { title: "Airshift(スタッフ登録)" },
      { title: "シフトボードインストール" },
    ],
  },
]
