# 07. 評価ロジック仕様（Evaluation Logic Specification）

本章では、Drawing Evaluation App の中核である  
**定量評価（Quantitative Evaluation）** と  
**定性的評価（Qualitative Evaluation：DeepSeek 講評）**  
のロジックを定義する。

本アプリでは、評価の精度を最大化するために  
**すべての画像（お題画像・模写画像）を白黒（Grayscale）として扱う**。  
この前提に基づき、以下の評価パイプラインを定義する。

---

## 7.1 評価処理の全体フロー

ユーザーが模写画像を投稿してから、スコア・ヒートマップ・講評が生成されるまでの処理は次の通り。

1. **画像受信（user_image）**
2. **白黒化（Grayscale Conversion）** ← 本仕様の核心  
3. **前処理（Preprocessing）**
   - サイズ統一  
   - ノイズ除去  
   - 輪郭の位置合わせ（Alignment）
4. **特徴量抽出（Feature Extraction）**
   - PyTorch（ResNet / ViT）により特徴ベクトルを生成
5. **類似度スコア算出（Similarity Calculation）**
6. **サブスコア算出（composition / line_accuracy / proportion）**
7. **白黒差分ヒートマップ生成（Heatmap Generation）**
8. **DeepSeek による講評生成（LLM Review）**
9. **最終結果を API レスポンスとして返却**

---

## 7.2 入力と出力（Input / Output）

### 7.2.1 入力
| 種類 | 内容 |
|------|------|
| user_image | ユーザーの模写画像（JPEG/PNG） |
| reference_image | お題画像（運営側が事前登録） |
| metadata | challenge_id / submission_id |

すべての画像は評価前に **必ず白黒化する**。

---

### 7.2.2 出力
| 出力項目 | 説明 |
|----------|------|
| overall_score | 総合スコア（0〜100） |
| scores | サブスコア（composition / line_accuracy / proportion） |
| heatmap_url | 白黒差分ヒートマップ |
| review | DeepSeek LLM による講評 |

---

## 7.3 画像前処理（Preprocessing）

評価精度向上のため、白黒化を含む前処理を行う。

---

### 7.3.1 白黒化（Grayscale Conversion）※必須

投稿されたカラー画像（RGB）はすべて白黒化する。

使用例（OpenCV）：

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
````

**理由：**

* 線・形の比較精度が向上
* 色・影の影響を排除
* モデル入力が軽量化
* ヒートマップ精度が向上
* 初心者向けの評価が安定

---

### 7.3.2 サイズ正規化（Resize）

すべての画像をモデル入力サイズ（例：224×224）へ統一。

---

### 7.3.3 ノイズ除去（Denoising）

* Gaussian Blur 等で軽度のノイズを除去
* 線画評価の安定化を目的とする

---

### 7.3.4 位置合わせ（Alignment）

* OpenCV テンプレートマッチング
* 輪郭の重心比較
* 必要に応じてアフィン変換

目的：構図ズレを補正し比較ノイズを削減。

---

## 7.4 特徴量抽出（Feature Extraction）

### 7.4.1 使用モデル

* ResNet-50（初期モデル）
* 将来的には ViT（Vision Transformer）も選択可能

---

### 7.4.2 白黒画像のモデル入力対応

ResNet は RGB（3チャンネル）前提のため、
白黒画像（1チャンネル）を **3チャンネルへ複製して入力**する。

PyTorch 実装例：

```python
img = gray_tensor.unsqueeze(0)       # shape: [1, H, W]
img = img.repeat(3, 1, 1)            # shape: [3, H, W]
```

---

### 7.4.3 特徴ベクトル（Feature Vector）

モデルは画像から**高次元ベクトル（例：2048次元）**を抽出する。

これが「画像の意味的な特徴」を表し、
reference_image と user_image の比較に使用される。

---

## 7.5 類似度スコア（Similarity Score）

### 7.5.1 Cosine Similarity（コサイン類似度）

評価の中心となる指標。

```
cos_sim = (A · B) / (||A|| * ||B||)
```

* A：模写画像の特徴ベクトル
* B：お題画像の特徴ベクトル

値は -1〜1 の範囲。

---

### 7.5.2 0〜100点スケールへの変換

```
score = max(0, min(100, round((cos_sim + 1) * 50)))
```

* cos_sim = -1 → 0点
* cos_sim = +1 → 100点

---

## 7.6 サブスコア（Sub Scores）

総合スコアを補完するため、以下 3つのサブスコアを算出する。

---

### 7.6.1 構図スコア（composition）

対象：全体の配置・バランス

アルゴリズム例：

* 画像の重心位置の比較
* SSIM（構造類似度）
* 大まかな形の一致度

---

### 7.6.2 線精度スコア（line_accuracy）

対象：線の位置・太さ・滑らかさ

手法：

* Canny Edge 検出
* 白黒線画なので一致度が高精度で出せる
* reference のエッジとの比較

---

### 7.6.3 比率スコア（proportion）

対象：形の大きさや比率の一致度

例：

* 輪郭の bounding box の比較
* パーツ比率（高さ・幅）
* ズレ量をスコア化

---

## 7.7 ヒートマップ生成（Heatmap Generation）

白黒画像同士の差分（絶対値）を元にヒートマップを生成する。

```python
diff = cv2.absdiff(gray_ref, gray_user)
heatmap = cv2.applyColorMap(diff, cv2.COLORMAP_JET)
```

* 赤：ズレが大きい
* 青：一致している
* 熟練者にも初心者にも見やすいフィードバックとなる

結果は PNG として保存し、URL を返す。

---

## 7.8 LLM 講評生成（DeepSeek Review）

### 7.8.1 入力プロンプト

DeepSeek には次の情報を渡す：

* overall_score
* サブスコア
* 差分ヒートマップの高差分領域
* お題の種類
* ※「白黒線画で評価している」ことを明記

---

### 7.8.2 講評形式（固定フォーマット）

```json
{
  "summary": "...",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."]
}
```

---

### 7.8.3 白黒前提のプロンプト例

> 「この画像は白黒線画として評価しています。
> 色の再現性は考慮せず、線の位置・形・輪郭の精度と比率・構図に基づいて講評を生成してください。」

---

## 7.9 スコア統合ロジック

総合スコア（overall_score）は以下の重みで統合する。

```
overall_score =
    0.7 * similarity_score
  + 0.1 * composition
  + 0.1 * line_accuracy
  + 0.1 * proportion
```

※ 重みは運営側で調整可能。
※ 白黒評価のため「色再現度」要素は排除されている。

---

## 7.10 パフォーマンス要件

| 工程          | 目標時間  |
| ----------- | ----- |
| 前処理（白黒化含む）  | 〜0.3秒 |
| 特徴量抽出       | 1〜2秒  |
| 類似度計算       | 0.1秒  |
| ヒートマップ生成    | 0.5秒  |
| DeepSeek 講評 | 1〜2秒  |

**合計：5秒以内（GPU 前提）**

---

## 7.11 将来的な拡張案（Grayscale 前提）

* 白黒線画から「理想線」を推定する AI
* パース誤差推定モデル（建築・背景向け）
* 線圧（ペン圧）推定モデル
* 連続講評（AIコーチ）
* 模写元画像の自動難易度推定

---

**End of Document**

```





