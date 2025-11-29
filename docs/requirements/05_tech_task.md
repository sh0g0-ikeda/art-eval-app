# 05. 技術タスク一覧（Tech Tasks）

本章では、Drawing Evaluation App を実装するにあたり必要となる  
**技術的タスク（Tech Tasks）** を整理する。

Chapter 02（System Architecture）、03（Functional Requirements）、  
04（Non-functional Requirements）、06（API Spec）、07（Evaluation Logic）、08（Database）、09（UI/UX）  
で定義された要件をもとに、  
実装フェーズで行うべきタスクを「どのレイヤで」「どの順番で」実施するかを明確にする。

---

## 5.1 全体方針

- できるだけ **MVP（最小実装）** に集中し、動くプロトタイプを早期に完成させる。
- フロントエンド、バックエンド、評価ロジック、インフラの順で **依存関係を意識した分解** を行う。
- DeepSeek や Supabase など外部サービスは、まず **最小限の連携** を目標とし、後から機能拡張する。
- タスクは「やるかどうか迷うレベル」ではなく、「やれば確実に価値があるもの」のみに絞る。

---

## 5.2 フロントエンド（React Native）タスク

### 5.2.1 環境構築

- [ ] Expo プロジェクト作成（TypeScript テンプレート）
- [ ] Lint / Prettier / 型チェック設定
- [ ] 環境変数管理（API ベースURL など）

### 5.2.2 認証周り（Googleログイン）

- [ ] Google OAuth（Expo / Firebase / Supabase いずれか）の検証
- [ ] ログイン画面（S-02）の実装
- [ ] 取得した ID Token をバックエンド `/auth/login/google` へ送信する処理の実装
- [ ] 返却された JWT のセキュアな保存（SecureStore 等）

### 5.2.3 画面構成・ナビゲーション

- [ ] ナビゲーションライブラリ導入（React Navigation など）
- [ ] 画面スタック定義
  - S-01 スプラッシュ
  - S-02 ログイン
  - S-03 ホーム / お題一覧
  - S-04 お題詳細
  - S-05 模写投稿
  - S-06 評価進行中
  - S-07 評価結果
  - S-08 履歴一覧
  - S-09 履歴詳細
  - S-10 設定

### 5.2.4 API クライアント実装

- [ ] Axios などの HTTP クライアント導入
- [ ] JWT をヘッダに付与するインターセプタ実装
- [ ] 以下エンドポイントへのクライアント関数を実装
  - [ ] `GET /challenges`
  - [ ] `GET /challenges/{id}`
  - [ ] `POST /challenges/{id}/submissions`（画像アップロード）
  - [ ] `GET /submissions/{submission_id}`
  - [ ] `GET /users/me/submissions`

### 5.2.5 画面別実装タスク

- [ ] S-03：お題一覧（カードリスト表示）
- [ ] S-04：お題詳細（画像＋説明表示）
- [ ] S-05：模写投稿（カメラ/ギャラリーからの画像選択、プレビュー表示）
- [ ] S-06：評価進行中（ポーリング処理）
- [ ] S-07：評価結果（スコア・サブスコア・ヒートマップ・講評の表示）
- [ ] S-08：履歴一覧
- [ ] S-09：履歴詳細
- [ ] S-10：簡易設定（ログアウトボタンなど）

---

## 5.3 バックエンド（FastAPI）タスク

### 5.3.1 環境構築

- [ ] FastAPI プロジェクト作成
- [ ] Poetry / pipenv 等で依存管理
- [ ] Uvicorn 起動設定
- [ ] CORS 設定（モバイルアプリからのアクセス許可）

### 5.3.2 認証・ユーザー管理

- [ ] Google ID Token 検証ロジックの実装
- [ ] `POST /auth/login/google` の実装
  - Google ID Token → provider / provider_user_id の抽出
  - `users` テーブルへの登録 or 取得
  - JWT 生成・返却
- [ ] JWT 認証デコレータ（Depends）実装

### 5.3.3 お題（challenges）API

- [ ] `GET /challenges`：一覧取得
  - フィルタリング（difficulty, category）
  - ページング（page, limit）
- [ ] `GET /challenges/{id}`：詳細取得
- [ ] 管理者用 `POST /admin/challenges`（MVPでは簡易でも可）

### 5.3.4 提出・評価（submissions）API

- [ ] `POST /challenges/{id}/submissions`
  - multipart/form-data で画像受信
  - ストレージへの画像保存
  - `submissions` 行の作成（status=processing）
  - 評価ジョブの起動（同期 or 簡易非同期）
- [ ] `GET /submissions/{submission_id}`
  - DB からスコア・サブスコア・講評・ヒートマップURLを取得
- [ ] `GET /users/me/submissions`
  - ログインユーザーの提出履歴を返す

---

## 5.4 評価ロジック（PyTorch + OpenCV）タスク

### 5.4.1 前処理

- [ ] 画像の読み込み処理（ストレージから）
- [ ] **白黒（Grayscale）化処理**の実装
- [ ] リサイズ・正規化処理

### 5.4.2 特徴量抽出

- [ ] ResNet / ViT モデルの読み込み
- [ ] 白黒1ch → 3ch複製してモデル入力
- [ ] 特徴ベクトル抽出関数

### 5.4.3 類似度計算・サブスコア

- [ ] Cosine Similarity による類似度計算
- [ ] 構図・線精度・比率のサブスコア算出ロジック
- [ ] 0〜100点へのスケーリング処理

### 5.4.4 ヒートマップ生成

- [ ] グレースケール差分の計算
- [ ] OpenCV のカラーマップを使ったヒートマップ生成
- [ ] 生成画像のストレージ保存
- [ ] パス（URL）を submissions に保存する処理

---

## 5.5 LLM 講評（DeepSeek API）タスク

- [ ] DeepSeek API クライアント（HTTP）作成
- [ ] プロンプト設計（白黒線画前提の指示を含める）
- [ ] スコア・サブスコア・お題情報を入力として渡す処理
- [ ] 返却される JSON 形式（summary / strengths / weaknesses / suggestions）にパース
- [ ] 結果を `submissions.review`（JSONB）に保存

---

## 5.6 データベース・ストレージタスク

### 5.6.1 DB マイグレーション

- [ ] `users` / `challenges` / `submissions` テーブルの作成
- [ ] 外部キー制約の設定
- [ ] インデックスの作成

（ツール例：Alembic / Supabase migration）

### 5.6.2 ストレージ

- [ ] Supabase Storage or S3 との接続設定
- [ ] パス命名規約に沿ったアップロード処理実装
  - `challenges/{id}/reference.png`
  - `submissions/{id}/original.png`
  - `submissions/{id}/heatmap.png`
- [ ] 画像アクセス用のURL生成処理

---

## 5.7 インフラ・環境構築タスク

- [ ] Dockerfile 作成（FastAPI + PyTorch 環境）
- [ ] docker-compose（DB / Backend / 可能であればストレージエミュレータ）
- [ ] dev / staging / prod 用の環境変数管理
- [ ] ログ出力設定（構造化ログが望ましい）

---

## 5.8 テスト・品質保証（QA）タスク

### 5.8.1 バックエンドテスト

- [ ] 認証フローのテスト（/auth/login/google）
- [ ] 各 API が期待通りのレスポンス形式を返すか確認
- [ ] 評価ロジックの単体テスト（特にスコアレンジ）

### 5.8.2 フロントエンド動作確認

- [ ] ログイン → お題選択 → 投稿 → 結果表示までの一連の E2E 動作
- [ ] 通信エラー時のハンドリング（再試行など）
- [ ] 低速回線時の UX 確認

---

## 5.9 優先度・実装順の提案

優先度高い順に並べると、以下の実装順が望ましい。

1. バックエンド基盤（FastAPI + DB）  
2. 認証フロー（Google → JWT）  
3. お題一覧API / 画面  
4. 模写投稿API（画像アップロードまで）  
5. 評価ロジックの最小版（類似度＋総合スコアのみ）  
6. DeepSeek 講評の組み込み  
7. ヒートマップ生成  
8. 履歴機能  
9. UIのブラッシュアップ・UX改善  
10. 非機能要件のチューニング（速度・ログ・監視）

---

**End of Document**


