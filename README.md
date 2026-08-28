# KTAK V2.1 DEV6-C3.2 — PWA Cloudflare 安全驗證修正

症狀：
- 從 iPhone 主畫面版 KTAK 開啟後，第一次加入房間出現：
  「加入失敗：請先完成 Cloudflare 安全驗證」
- 使用者看不到該去哪裡完成驗證。

原因：
- 主畫面 Web App 第一次啟動時可能沒有原本瀏覽器中的 Supabase anonymous session。
- 因此 KTAK 必須先完成 Turnstile，才能建立新的 anonymous auth session。
- 舊 UI 把 Turnstile 放在所有表單最下方，不夠明顯。

修正：
- Cloudflare Turnstile 移到加入／創建／恢復區塊上方。
- 明確標示「第一次從這個瀏覽器／主畫面 KTAK 使用時先驗證」。
- 若使用者未驗證就按加入，KTAK 會自動捲到驗證區。
- 驗證成功後狀態顯示「可以加入／創建房間」。
- Push / 定位 / 聊天 / 戰術板功能維持 C3.1。

部署：
只覆蓋 index.html、sw.js、manifest.webmanifest、README.md。
保留 config.js。
