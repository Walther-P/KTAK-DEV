# KTAK V2.1 DEV6-B5 — 跨瀏覽器定位權限版

本版包含 DEV6-B4 頭像顯示修正，並調整定位權限流程。

定位流程：
- 使用者按「分享我的位置」時，立即呼叫標準 Geolocation `getCurrentPosition()`。
- 權限尚未決定（prompt）時，由瀏覽器／作業系統顯示原生定位權限詢問。
- 允許後立即取得第一筆位置，再啟動 `watchPosition()` 持續更新。
- 若權限已被拒絕，網頁不能強迫瀏覽器再次顯示系統詢問；UI 會明確提示到瀏覽器／系統設定重新允許。
- 支援 Permissions API 時會辨識 granted / prompt / denied；不支援時仍用標準 Geolocation fallback。
- 檢查 HTTPS secure context 與 Geolocation API 支援。

重要限制：
網站無法控制系統權限視窗的文字與選項，也無法在使用者已拒絕後強制重新跳出詢問。
這是瀏覽器／OS 的安全限制，不是 KTAK 可繞過的行為。

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md；保留原 config.js。
