
# 06. API仕様（API Specification）

本章では、Drawing Evaluation App のバックエンド API の仕様を定義する。  
API はフロントエンド（React Native）とバックエンド（FastAPI）間の通信に使用され、  
Chapter 01（概要）および Chapter 03（機能要件）で定義した要件に基づく。

本アプリにおける API の役割は主に以下の通りである。

- Google 認証によるユーザーログイン  
- お題（Challenge）の取得  
- 模写画像の投稿  
- PyTorch による定量評価  
- DeepSeek API を用いた定性的評価（講評）  
- 評価履歴の取得  

本章では、これらを実現するための API を順に記述する。

---

## 6.1 API 基本仕様

本アプリが提供する API の基本仕様は下表の通りである。

| 項目 | 内容 |
|------|------|
| ベースURL | `https://api.example.com/v1` |
| データ形式 | JSON |
| 認証方式 | JWT（Bearer Token） |
| 画像投稿 | multipart/form-data |
| 通信方式 | HTTPS |

### 6.1.1 認証ヘッダー
ログイン後に取得した JWT は、以下の形式で送信する。

```

Authorization: Bearer <token>

````

### 6.1.2 エラーレスポンス形式
エラーは以下の共通形式を用いる。

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "入力値が不正です。"
  }
}
````

代表的なエラーコードを以下に示す。

| code          | 説明              |
| ------------- | --------------- |
| UNAUTHORIZED  | 認証が必要           |
| INVALID_INPUT | 入力データ形式が不正      |
| NOT_FOUND     | 指定されたリソースが存在しない |
| SERVER_ERROR  | サーバー内部エラー       |

---

## 6.2 認証（Auth）API

### 6.2.1 Googleログイン

**POST /auth/login/google**

ユーザーが Google ID Token を用いてログインし、アプリ専用の JWT を取得する。

#### リクエスト例

```json
{
  "google_id_token": "xxx.yyy.zzz"
}
```

#### レスポンス例

```json
{
  "access_token": "jwt_token",
  "token_type": "bearer",
  "user": {
    "id": "user_123",
    "name": "山田太郎",
    "icon_url": "https://example.com/icon.png"
  }
}
```

---

## 6.3 ユーザー（Users）API

### 6.3.1 自分のユーザープロフィール取得

**GET /users/me**

ログイン済みユーザーの基本情報および簡易統計情報を返す。

#### レスポンス例

```json
{
  "id": "user_123",
  "name": "山田太郎",
  "stats": {
    "submission_count": 12,
    "average_score": 74.2
  }
}
```

---

## 6.4 お題（Challenge）API

お題は本アプリの中心となる学習単位であり、ユーザーは運営が提供したお題画像を模写して評価を受ける。

---

### 6.4.1 お題一覧取得

**GET /challenges**

難易度・カテゴリによる絞り込みに対応した、お題一覧を返す。

#### クエリパラメータ

| 名称         | 説明                                 |
| ---------- | ---------------------------------- |
| difficulty | beginner / intermediate / advanced |
| category   | shapes / portrait / still_life など  |
| page       | ページ番号                              |
| limit      | 1ページあたりの件数                         |

#### レスポンス例

```json
{
  "items": [
    {
      "id": "challenge_001",
      "title": "基本の形（初級）",
      "difficulty": "beginner",
      "category": "shapes",
      "thumbnail_url": "https://..."
    }
  ],
  "page": 1,
  "total_pages": 3
}
```

---

### 6.4.2 お題詳細

**GET /challenges/{id}**

お題の課題画像・説明文・コツなどの詳細情報を返す。

#### レスポンス例

```json
{
  "id": "challenge_001",
  "title": "基本の形（初級）",
  "description": "丸・四角・三角の模写練習です。",
  "difficulty": "beginner",
  "category": "shapes",
  "reference_image_url": "https://...",
  "tips": "輪郭を丁寧に描きましょう。"
}
```

---

## 6.5 模写投稿（Submission）API

---

### 6.5.1 模写画像投稿

**POST /challenges/{id}/submissions**

ユーザーが模写画像をアップロードし、評価処理を開始する。

#### 注意点

* multipart/form-data形式
* 画像ファイルは最大 10MB を推奨
* サーバーは即時に submission_id を返し、評価は非同期で進む

#### レスポンス例

```json
{
  "submission_id": "sub_abc123",
  "status": "processing"
}
```

---

## 6.6 評価結果（Evaluation）API

---

### 6.6.1 投稿結果取得

**GET /submissions/{submission_id}**

定量スコア・ヒートマップ・DeepSeek 講評など、評価の全結果を取得する。

#### レスポンス例

```json
{
  "submission_id": "sub_abc123",
  "challenge_id": "challenge_001",
  "status": "completed",
  "overall_score": 82,
  "scores": {
    "composition": 78,
    "line_accuracy": 84,
    "proportion": 80
  },
  "heatmap_url": "https://...",
  "review": {
    "summary": "全体の比率は良く取れています。",
    "strengths": ["線が安定している"],
    "weaknesses": ["輪郭が部分的に太いです"],
    "suggestions": ["一定の線の強弱を意識して描くと改善します"]
  }
}
```

---

## 6.7 履歴（History）API

---

### 6.7.1 自分の評価履歴一覧取得

**GET /users/me/submissions**

ユーザーが過去に投稿したすべての提出物（Submission）の一覧を返す。

#### レスポンス例

```json
{
  "items": [
    {
      "submission_id": "sub_001",
      "challenge_id": "challenge_001",
      "overall_score": 92,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## 6.8 管理者（Admin）API

---

### 6.8.1 お題登録

**POST /admin/challenges**

運営者が新しいお題を追加するときに使用する。
multipart/form-data により画像とメタ情報を投稿する。

#### レスポンス例

```json
{
  "id": "challenge_001",
  "status": "created"
}
```

---

## 6.9 エラー仕様（共通）

本アプリで返す代表的なエラーコードは以下の通りである。

| code          | 説明     | よくある原因           |
| ------------- | ------ | ---------------- |
| UNAUTHORIZED  | 認証が必要  | トークン未設定          |
| INVALID_INPUT | 入力不正   | 形式エラー・画像破損       |
| NOT_FOUND     | リソースなし | challenge_id の誤り |
| SERVER_ERROR  | 内部エラー  | モデルの評価失敗など       |

---

## 6.10 今後の拡張（参考）

* お題タグAPI
* ランキングAPI
* 上達推移API
* AIお手本生成API
* カスタムお題のユーザー投稿機能

---



