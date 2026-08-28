# KTAK V2.1 DEV6-C3.1 — Push 前端修正版

修正 C3：
- C3 的 Push JavaScript 被錯誤插入 CSS 區塊，導致 triggerChatPush 未定義。
- 同一錯誤也破壞後續 CSS，所以聊天室介面比例異常。
- Push JavaScript 現在插入真正的 JavaScript chat 區段。
- 聊天室 grid 改為 4 列：資訊 / Push 設定 / 訊息 / 輸入框。
- Push 按鈕改成較緊湊，不再在桌機拉滿整列。
- Service Worker 只負責 Push，不攔截一般 fetch。
- Push 發送失敗不會再讓已成功寫入的聊天訊息顯示「傳送失敗」。

保留：
- DEV6-B 定位
- 頭像功能（裁切顯示問題暫列已知 bug）
- 聊天照片
- 房間生命週期

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md。
保留 config.js。
