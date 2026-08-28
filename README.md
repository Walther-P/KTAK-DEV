# KTAK V2.1 DEV6-B6.2 — 頭像裁切輸出修正版

問題定位：
如果裁切畫面顯示正確，但地圖頭像卻顯示成照片其他角落，代表問題發生在「裁切確認」之後。
舊流程會把已裁好的 512×512 JPEG 再 decode / canvas / JPEG 一次，這是多餘且可能受 iOS/WebKit 圖片方向處理影響的步驟。

修正：
- 使用者確認的 512×512 JPEG 直接上傳。
- 不再對頭像做第二次 compressImageFile。
- 頭像顯示固定 object-position:center。
- 保留 signed URL 實際載入驗證。
- 保留 B6.1 手機工具修正、B6 頭像裁切、B5 定位權限。

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md；保留 config.js。
