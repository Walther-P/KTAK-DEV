# KTAK V2.1 DEV6-C3 — 聊天 Web Push

新增：
- 聊天室「此裝置通知」ON / OFF。
- 通知訊息預覽 ON / OFF。
- 使用者按開啟通知時才呼叫 Notification.requestPermission()。
- 每台瀏覽器 / Home Screen Web App 各自建立 PushSubscription。
- 訂閱存入 ktak_push_subscriptions，受 RLS 約束。
- 聊天訊息 DB insert 成功後呼叫 ktak-push；Push 失敗不回滾聊天訊息。
- sw.js 加入 push 與 notificationclick。
- iPhone / iPad 若不是 Home Screen Web App，UI 會提示先加入主畫面。
- 不再在頁面啟動時 unregister Service Worker。

保留：
- DEV6-B 定位
- 頭像功能（已知：某些圖片的地圖頭像裁切顯示仍可能錯位，暫不阻擋主線）
- 任務地圖 / 戰術板 / 聊天照片 / 房間生命週期功能

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md。
不要覆蓋 config.js。

測試建議：
1. 兩台裝置加入同一房。
2. 接收端開「聊天通知」。
3. iPhone/iPad 必須先加入主畫面，並從主畫面圖示開啟 KTAK。
4. 把接收端 KTAK 切到背景。
5. 另一台送一則聊天室文字。
6. 檢查系統通知。
