# 02. システム構成（System Architecture）

本章では、Drawing Evaluation App のシステム構成を定義する。  
本アプリは、以下のコンポーネントから構成される。

- **モバイルアプリ**：React Native（iOS / Android）
- **APIサーバー**：FastAPI（Python）
- **評価ロジック**：PyTorch + OpenCV（画像評価）、DeepSeek API（講評）
- **データベース**：PostgreSQL
- **オブジェクトストレージ**：Supabase Storage または S3 互換ストレージ
- **認証基盤**：Google OAuth（＋JWT）

本章では、それぞれの役割と、コンポーネント間のデータフローを整理する。

---

## 2.1 システム全体像

Drawing Evaluation App は、大きく以下の3レイヤに分かれる。

1. **プレゼンテーション層（フロントエンド）**
   - React Native による iOS / Android アプリ
   - ユーザー操作（ログイン、模写投稿、結果閲覧）を担当

2. **アプリケーション層（APIサーバー）**
   - FastAPI による REST API
   - 認証、ビジネスロジック、DBアクセス、評価ジョブの起動などを担当

3. **評価・データ層（モデル / ストレージ / DB）**
   - PyTorch + OpenCV による画像評価（白黒前処理を含む）
   - DeepSeek API による講評生成
   - Supabase Storage / S3 による画像保存
   - PostgreSQL によるユーザー・お題・提出・スコア・講評の保存

---

## 2.2 コンポーネント一覧と役割

### 2.2.1 モバイルアプリ（React Native）

- 対象：iOS / Android
- 主な役割：
  - ログイン画面（Googleログイン）
  - お題一覧・詳細表示
  - 模写画像の撮影・選択・アップロード
  - 評価結果（スコア・ヒートマップ・講評）の表示
  - 履歴一覧・詳細の表示

- 通信：
  - `HTTPS + JSON` で FastAPI と通信
  - 画像アップロード時のみ `multipart/form-data`

---

### 2.2.2 APIサーバー（FastAPI）

- 言語：Python
- 役割：
  - フロントからのリクエスト受付
  - 認証トークン（JWT）の検証
  - お題・提出・履歴の管理
  - 画像評価処理のオーケストレーション
  - DeepSeek API との連携

- 主な機能モジュール：
  - `auth`：ログイン・JWT発行
  - `challenges`：お題一覧・詳細
  - `submissions`：模写投稿受付、結果取得
  - `evaluation`：PyTorch / OpenCV / DeepSeek を呼び出す評価ロジック
  - `admin`：お題登録・編集（運営向け）

---

### 2.2.3 画像評価モジュール（PyTorch + OpenCV）

- APIサーバー内、または別プロセスの Python モジュールとして実装
- 役割：
  1. 画像の読み込み
  2. **白黒化（Grayscale）**
  3. サイズ正規化
  4. 特徴量抽出（ResNet / ViT）
  5. 類似度スコア算出（Cosine Similarity）
  6. サブスコア算出（構図・線精度・比率）
  7. 差分ヒートマップ生成（白黒ベース）

- 出力：
  - `overall_score`
  - `sub_scores`（composition / line_accuracy / proportion）
  - `heatmap_image_path`（ストレージ用パス）

---

### 2.2.4 LLM講評モジュール（DeepSeek API クライアント）

- FastAPI から外部 HTTP API として呼び出す
- 役割：
  - スコア・サブスコア・お題情報を基にプロンプトを組み立て
  - DeepSeek にリクエスト
  - 講評テキスト（summary / strengths / weaknesses / suggestions）を取得
  - 取得結果を DB に保存し、APIレスポンスに含める

---

### 2.2.5 データベース（PostgreSQL）

- 主なテーブル（例）：
  - `users`：ユーザー情報
  - `challenges`：お題情報（タイトル、難易度、カテゴリ、画像パス）
  - `submissions`：提出情報（user_id, challenge_id, スコア、講評、作成日時）
  - `evaluation_logs`：評価処理ログ（必要に応じて）

- 役割：
  - 認証済みユーザーの識別
  - 提出履歴の永続化
  - お題のメタデータ管理

---

### 2.2.6 オブジェクトストレージ（Supabase Storage / S3）

- 保存対象：
  - お題画像（reference_image）
  - ユーザーの模写画像（user_image）
  - ヒートマップ画像（heatmap_image）

- アクセス方法：
  - バックエンドから SDK または HTTP API 経由でアップロード / 取得
  - クライアントには署名付きURLまたは公開URLを渡す

---

## 2.3 デプロイ構成（Deployment）

### 2.3.1 想定デプロイ

- **モバイルアプリ**
  - iOS：App Store 配信
  - Android：Google Play 配信

- **バックエンド**
  - FastAPI：コンテナ（Docker）としてデプロイ
    - 選択肢：AWS EC2 / ECS / Render / Railway 等
  - モデル推論：同一コンテナ内またはGPU対応インスタンス上

- **データベース**
  - マネージド PostgreSQL（Supabase / RDS / Neon 等）

- **ストレージ**
  - Supabase Storage または S3 互換バケット

---

### 2.3.2 環境分割

- `development`：開発環境（ローカル / 小規模クラウド）
- `staging`：テスト環境（βテスト用）
- `production`：本番環境

各環境ごとに以下を分ける：

- DBインスタンス
- ストレージバケット
- DeepSeek APIキー
- Google OAuth クライアントID

---

## 2.4 主なユースケース別データフロー

本節では、代表的なフローをテキストで整理する。

---

### 2.4.1 ログインフロー

1. ユーザーがスマホアプリで「Googleでログイン」をタップ
2. OS標準の Google 認証画面でログイン
3. アプリは Google ID Token を取得
4. アプリ → FastAPI `/auth/login/google` に ID Token を送信
5. FastAPI が検証し、ユーザーを DB に登録/取得
6. FastAPI が JWT（access_token）を生成して返却
7. アプリは JWT を保存し、以降の API 呼び出しに利用

---

### 2.4.2 お題一覧取得フロー

1. アプリが `/challenges` に GET
2. FastAPI が DB の `challenges` テーブルを参照
3. お題のメタ情報（タイトル・難易度・カテゴリ・サムネURL）を返却
4. アプリがリスト表示する

---

### 2.4.3 模写投稿〜評価フロー（重要）

1. ユーザーが任意のお題詳細画面を開く
2. 「模写を投稿する」からカメラ or ギャラリーで画像を取得
3. アプリが `/challenges/{id}/submissions` に `multipart/form-data` で画像をアップロード
4. FastAPI が画像ファイルを受信し、一時ストレージに保存
5. FastAPI が `submissions` レコードを作成し、`submission_id` を発行
6. FastAPI が評価処理（PyTorch + OpenCV + DeepSeek）のジョブを起動
   - 画像を **白黒化**
   - 特徴量抽出 → 類似度計算 → スコア算出
   - ヒートマップ生成 → ストレージ保存
   - DeepSeek API で講評生成 → DB保存
7. アプリは `/submissions/{submission_id}` をポーリングして進捗確認
8. 評価完了後、API が `status=completed` とスコア・講評・ヒートマップURLを返す
9. アプリが結果画面を表示

---

### 2.4.4 履歴表示フロー

1. アプリが `/users/me/submissions` に GET
2. FastAPI が `submissions` テーブルから該当ユーザーの履歴を取得
3. スコア・日付・お題タイトルなどを返却
4. アプリが一覧として表示
5. 個別履歴をタップすると `/submissions/{submission_id}` で詳細を再取得・表示

---

## 2.5 設定・秘密情報の取り扱い

- DeepSeek API キー  
- Google OAuth クライアントID / シークレット  
- JWT 署名用シークレットキー  
- DB 接続文字列  
- ストレージの認証情報

これらはコードベースに直書きせず、  
`.env` やクラウドの Secret Manager に保存し、  
FastAPI 起動時に環境変数として読み込む。

---

## 2.6 ログ・監視

- FastAPI ログ：アクセスログ・エラーログ
- 評価処理ログ：評価開始/終了/失敗
- 重要メトリクス：
  - 1リクエストあたりの評価時間
  - エラー率（DeepSeek/APIエラー含む）
  - 画像アップロード失敗数

将来的には APM（Application Performance Monitoring）の導入も検討する。

---

**End of Document**


