# KTAK V2.1 DEV6-B6.1 — 手機工具修正版

修正 DEV6-B6 的前端初始化錯誤：
- 頭像裁切 DOM 原本被放在主 JavaScript 後方。
- JavaScript 啟動時抓不到裁切元件，造成 runtime error，後續地圖/戰術板工具事件沒有完成綁定。
- 已把裁切 DOM 移到所有 JavaScript 之前。
- 同時增加 null guard，避免未來裁切 UI 異常時拖垮整個 KTAK 工具列。

保留：
- DEV6-B6 頭像裁切
- DEV6-B5 跨瀏覽器定位權限
- DEV6-B4 頭像載入驗證

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md；保留 config.js。
