# KTAK V2.1 DEV6-A — 房間生命週期版

新增：
- 指揮官可延長房間 1／7／30 天。
- 延長是從「目前到期時間」往後加，不會把剩餘時間吃掉。
- 防誤按：單一房間不能一次堆到超過未來 90 天；之後仍可持續再延長。
- 修正前端沒有讀取 `expires_at`，導致到期時間可能顯示空白的問題。
- 顯示剩餘約幾小時／幾天。
- 新增 `ktak-cleanup` Edge Function：刪除過期房間前先透過 Storage API 清除兩個 private buckets。
- Database 子資料利用既有 `ON DELETE CASCADE` 清除。
- Audit log 另外刪除，避免房間刪掉後仍殘留管理紀錄。
- Cleanup 會在真正刪除前再次檢查 `expires_at`，避免和最後一刻的延長操作競爭。
- 停止把完整任務內容寫進 browser localStorage，並在載入 DEV6-A 時清除舊的 KTAK room cache。

保留 DEV5.1 全部功能。
