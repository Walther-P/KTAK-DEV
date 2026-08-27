# KTAK V2.1 DEV2 — Google Maps 成本保護

本版在 V2.1 DEV1 基礎上新增：

- Google Maps 不再於網站啟動時載入。
- 只有已登入房間的成員第一次打開「任務地圖」時，才嘗試建立 Google Map。
- Supabase RPC 會先取得當月一個 Google Map load 安全額度。
- KTAK 目前保守限制為每個 Google billing month 8,000 次。
- 達到 8,000 後自動使用 OpenStreetMap。
- 安全額度 RPC 發生錯誤時採 fail-closed：直接使用 OSM，不建立 Google Map。
- Google / OSM 手動切換仍保留；同一頁已建立的 Google Map 不重複計數。

注意：
這是 KTAK 應用程式層的保護，不是 Google Cloud Billing 的官方硬停用功能。
