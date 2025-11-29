# 08. データベース構成（Database Architecture）

本章では、Drawing Evaluation App におけるデータベース構成を定義する。  
Chapter 02（System Architecture）、Chapter 06（API Spec）、Chapter 07（Evaluation Logic）で定義した要件を満たすための、  
テーブル構造・リレーション・設計方針を示す。

データベースは **PostgreSQL** を前提とし、主キーには原則として **UUID** を用いる。

---

## 8.1 設計方針

本アプリのデータは大きく以下に分類される。

1. **ユーザー情報（Users）**
2. **お題情報（Challenges）**
3. **提出情報（Submissions）**
4. **評価結果・講評（Evaluation Result / Review）**

設計方針は以下の通りとする。

- まずは **シンプルな3テーブル構成**（users / challenges / submissions）を採用する  
- DeepSeek 講評やサブスコアは、当面は `submissions` テーブル内に JSON として保持する  
- 将来的な拡張（コメント機能・ランキングなど）に備え、正規化しやすい構成とする  
- 画像そのものは DB に格納せず、**ストレージのパス（URL）を保持するのみ** とする  

---

## 8.2 ER 図（Entity Relationship Diagram）

以下は、初期バージョンにおける ER 図のイメージである。

```mermaid
erDiagram

    users ||--o{ submissions : "1ユーザー : N提出"
    challenges ||--o{ submissions : "1お題 : N提出"

    users {
        uuid id
        string provider
        string provider_user_id
        string display_name
        string icon_url
        timestamptz created_at
        timestamptz updated_at
    }

    challenges {
        uuid id
        string title
        string description
        string difficulty
        string category
        string reference_image_url
        string thumbnail_url
        string tips
        timestamptz created_at
        timestamptz updated_at
    }

    submissions {
        uuid id
        uuid user_id
        uuid challenge_id
        string user_image_url
        string heatmap_image_url
        integer overall_score
        jsonb sub_scores
        jsonb review
        string status
        timestamptz created_at
        timestamptz updated_at
    }
````

---

## 8.3 テーブル一覧

| テーブル名         | 役割                  |
| ------------- | ------------------- |
| `users`       | アプリ利用ユーザー情報         |
| `challenges`  | お題（課題画像）情報          |
| `submissions` | 各ユーザーによる模写提出＆その評価結果 |

※ 将来機能のために新テーブルを追加する場合は、本章に追記する。

---

## 8.4 テーブル定義詳細

### 8.4.1 `users` テーブル

アプリ利用ユーザーを表すテーブル。
Google アカウントとアプリ内ユーザーを紐づける。

| カラム名               | 型           | NOT NULL | 説明                     |
| ------------------ | ----------- | -------- | ---------------------- |
| `id`               | UUID        | YES      | アプリ内ユーザーID（PK）         |
| `provider`         | TEXT        | YES      | 認証プロバイダ（例: `"google"`） |
| `provider_user_id` | TEXT        | YES      | Google側ユーザーID（sub）     |
| `display_name`     | TEXT        | YES      | 表示名                    |
| `icon_url`         | TEXT        | NO       | アイコン画像URL（任意）          |
| `created_at`       | TIMESTAMPTZ | YES      | 登録日時                   |
| `updated_at`       | TIMESTAMPTZ | YES      | 更新日時                   |

**制約・インデックス**

* PK：`PRIMARY KEY (id)`
* 一意制約：`UNIQUE (provider, provider_user_id)`
* インデックス：`INDEX ON (provider_user_id)`（ログイン時に利用）

---

### 8.4.2 `challenges` テーブル

運営側が用意する「お題画像」の情報を持つテーブル。

| カラム名                  | 型           | NOT NULL | 説明                                            |
| --------------------- | ----------- | -------- | --------------------------------------------- |
| `id`                  | UUID        | YES      | お題ID（PK）                                      |
| `title`               | TEXT        | YES      | お題タイトル                                        |
| `description`         | TEXT        | NO       | お題の説明文                                        |
| `difficulty`          | TEXT        | YES      | 難易度（`beginner` / `intermediate` / `advanced`） |
| `category`            | TEXT        | YES      | カテゴリ（`shapes` / `portrait` / `still_life` など） |
| `reference_image_url` | TEXT        | YES      | 基準（お題）画像のURL                                  |
| `thumbnail_url`       | TEXT        | YES      | 一覧表示用サムネイル画像URL                               |
| `tips`                | TEXT        | NO       | お題のコツ・アドバイス                                   |
| `created_at`          | TIMESTAMPTZ | YES      | 登録日時                                          |
| `updated_at`          | TIMESTAMPTZ | YES      | 更新日時                                          |

**制約・インデックス**

* PK：`PRIMARY KEY (id)`
* インデックス：`INDEX ON (difficulty, category)`

**備考**

* 画像ファイルそのものは Supabase Storage / S3 に保存し、ここではパスのみを保持する
* 画像は評価処理時に読み込み、**サーバー側で白黒化して利用する**

---

### 8.4.3 `submissions` テーブル

ユーザーが投稿した模写画像、およびその評価結果・講評をまとめて保持するテーブル。

| カラム名                | 型           | NOT NULL | 説明                                                                     |
| ------------------- | ----------- | -------- | ---------------------------------------------------------------------- |
| `id`                | UUID        | YES      | 提出ID（PK）                                                               |
| `user_id`           | UUID        | YES      | ユーザーID（FK → users.id）                                                  |
| `challenge_id`      | UUID        | YES      | お題ID（FK → challenges.id）                                               |
| `user_image_url`    | TEXT        | YES      | 投稿された模写画像のURL（カラーでも可、評価時に白黒化）                                          |
| `heatmap_image_url` | TEXT        | NO       | 差分ヒートマップ画像のURL（生成後にセット）                                                |
| `overall_score`     | INTEGER     | NO       | 総合スコア（0〜100）。評価完了後にセット                                                 |
| `sub_scores`        | JSONB       | NO       | サブスコア（例：`{"composition":78,"line_accuracy":84,"proportion":80}`）       |
| `review`            | JSONB       | NO       | DeepSeek 講評（`summary`, `strengths[]`, `weaknesses[]`, `suggestions[]`） |
| `status`            | TEXT        | YES      | 評価状態（`processing` / `completed` / `failed`）                            |
| `created_at`        | TIMESTAMPTZ | YES      | 提出日時                                                                   |
| `updated_at`        | TIMESTAMPTZ | YES      | 更新日時                                                                   |

**制約・インデックス**

* PK：`PRIMARY KEY (id)`
* FK：`FOREIGN KEY (user_id) REFERENCES users (id)`
* FK：`FOREIGN KEY (challenge_id) REFERENCES challenges (id)`
* インデックス：

  * `INDEX ON (user_id, created_at DESC)`（履歴表示）
  * `INDEX ON (challenge_id)`（お題別集計用）
  * `INDEX ON (status)`（バッチ処理で `processing` を拾う場合）

**備考**

* `overall_score`・`sub_scores`・`review` は評価完了後に更新される
* `status = 'processing'` の状態でレコードを作成し、評価完了時に `completed` に更新する
* `review` は JSONB とすることで、将来的な項目追加（例：`"level":"beginner"` など）が容易になる

---

## 8.5 画像ストレージの設計方針

**前提：** 画像は DB にバイナリ格納せず、オブジェクトストレージ（Supabase Storage / S3）に保存する。

### 8.5.1 パス命名ルール（例）

* お題画像：`challenges/{challenge_id}/reference.png`
* サムネイル：`challenges/{challenge_id}/thumb.png`
* ユーザー投稿：`submissions/{submission_id}/original.png`
* ヒートマップ：`submissions/{submission_id}/heatmap.png`

DB にはフルURL、もしくはストレージ内パスを保持する。

---

## 8.6 スキーマ変更ポリシー

* 将来的にレビュー機能やランキング機能を導入する場合、

  * `likes` や `comments` を別テーブルとして追加する
  * `submissions` テーブルの JSONB カラムに項目追加する
* 変更時は以下を徹底する：

  1. まず本章（08 Database Architecture）に差分を追記
  2. 次に Chapter 06（API Spec）に対応するフィールドを追記
  3. 最後に実装を更新

---

## 8.7 将来拡張案

将来的な機能追加を見越し、以下のテーブル追加を想定している。

* `user_profiles`：自己紹介文・SNSリンクなど詳細プロフィール
* `challenge_tags` / `tags`：お題のタグ付け
* `leaderboards`：ランキング情報（集計結果をキャッシュ）
* `feedbacks`：ユーザーがアプリに対して送るフィードバック

これらは現時点のMVPには含めないが、
テーブル設計はそれらを阻害しない形となっている。

---

**End of Document**


