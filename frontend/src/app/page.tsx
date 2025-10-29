"use client";

import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      alert("画像を選択してください！");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://10.0.2.15:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setScore(res.data.score);
    } catch (error) {
      alert("アップロードに失敗しました。FastAPIが動いているか確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">🎨 模写評価アプリ</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {loading ? "送信中..." : "アップロード"}
      </button>

      {score !== null && (
        <p className="mt-6 text-lg font-semibold">
          AIスコア：<span className="text-blue-700">{score}</span> / 100
        </p>
      )}
    </div>
  );
}
