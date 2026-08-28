# KTAK V2.1 DEV6-B6 — 頭像裁切＋跨瀏覽器定位權限

新增：
- 選擇頭像後先進入裁切畫面。
- 可拖曳照片調整位置。
- 可用滑桿縮放。
- 圓框即為實際頭像顯示範圍。
- 確認後輸出 512×512 JPEG，再走既有 Storage 上傳流程。
- 保留 DEV6-B5 的跨瀏覽器定位權限流程與 DEV6-B4 的頭像載入驗證。

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md；保留 config.js。
