# GeoDeck 0.6.0 — 地圖與停車輔助試用版

GeoDeck 整理目的地附近的環境資訊與停車資訊，選好地點後交給導航 App 計算路線。台灣預設 Google Maps，韓國預設 NAVER Maps，也可手動切換。開車、步行與大眾運輸均使用目的地座標開啟導航服務；GeoDeck 不計算最快路線或班次，也無法讀取另一個 App 正在使用的路線。

原有網站：https://walther-p.github.io/KTAK-DEV/geodeck/ 。部署後可在設定確認版本 **0.6.0**；舊版主畫面捷徑可透過「檢查更新」載入新版。

## 這版可試用的功能

- 深色 MapLibre / OpenFreeMap 底圖，手機與桌面響應式介面。
- 按下搜尋才查詢地名、地址；座標與已收藏的同名地點可離線解析。搜尋結果需要確認，因為開放地名資料的涵蓋與中文搜尋精度不等同 Google。
- 保留位置天氣、AQI、雷達時間軸、雲圖、台灣監視器目錄與地震圖層。各來源失敗各自顯示，沒有資料不代表沒有風險。
- 台南官方停車資訊與既有台北官方停車資訊，查詢範圍三公里、最多三十筆。車位數區分零、未知與過期；資料超過五分鐘不當成即時車位。
- 目的地 → 附近停車場 → 導航；保留原目的地，可接著步行前往。換成新的目的地會建立新的停車行程。
- 手動記住停車位置，再開啟步行導航回到車位；收藏、備註、停車記錄儲存在目前裝置，可匯出收藏備份。
- PWA 快取應用程式，曾載入後可離線看收藏和備註。地圖、搜尋、天氣與即時停車仍需要網路，並未提供離線底圖。

## 費用與服務界線

這版不載入 Google 地圖 SDK、Places API、Routes API 或 `../config.js`，不需任何 Google API 金鑰。Google Maps 入口使用不需金鑰的 Maps URLs，NAVER 使用官方 App URL scheme；實際導航由使用者開啟的 App 負責，NAVER 需先安裝。

OpenFreeMap 公共底圖目前不需金鑰；Photon 公共搜尋有合理用量限制且無可用性保證。Open-Meteo 免費服務僅適用其非商業用量與條款。這是個人、非商業用途試用配置，未設置付款帳戶、付費 API 或付費自動備援；服務限流時顯示無法取得。不能把公共服務免費等同永久無限額度。

台南來源、時間處理與靜態備援說明見 [停車資料來源](data/PARKING.md)。底圖保留供應商與 OpenStreetMap 署名，MapLibre 授權保存在 `vendor/`。

## 架構與更換地圖

- `map-config.js`：底圖樣式、搜尋服務位址。
- `map-provider.js`：地圖、標記與影像圖層介面，底圖供應商替換集中在此。
- `open-places.js`：搜尋、地區辨識、附近類別查詢，含排隊與快取。
- `journey.js` / `navigation-ui.js`：地區推薦、導航連結、目的地與停車行程。
- `taiwan-parking.js`：城市來源登錄、台南資料正規化；保留既有台北 adapter。

舊的 Google 路線、Places 與 Drive Mode 檔案保留作歷史參考，這版不載入它們。若日後改回 Google 底圖，仍需重新確認 API 用量、金鑰與費用；並非只改樣式網址。更早的實作記錄見 [0.5 歷史文件](README-0.5.md)。

## 開發與驗證

在儲存庫根目錄執行：

```sh
node --test geodeck/tests/*.test.js
node geodeck/scripts/preview.mjs
```

預覽網址為 `http://127.0.0.1:4173/geodeck/`。有 Playwright 的環境可設定 `PLAYWRIGHT_PATH` 後執行 `node geodeck/scripts/smoke.cjs`，選用 `BROWSER_ENGINE=webkit` 驗證 WebKit；Chromium 測試使用本機 Edge。`check-offline.cjs` 檢查實際雷達、監視器圖層與 PWA 離線收藏。這些測試使用真實公共資料，輸出放在未追蹤的 `qa/`。WebKit 與 Chromium 已通過手機尺寸流程，桌面與離線流程亦已驗證；真實 iPhone 的定位授權、主畫面更新及導航 App 跳轉仍需實機確認。

目前沒有背景定位、鎖屏提醒、逐向導航、測速提醒或沿途風險分析。地區自動推薦目前僅針對台灣和韓國驗證，其餘地區提供 Google 入口及手動選擇，沒有宣稱全球最佳導航。停車資訊只涵蓋已串接的城市。

本次起點為 `1265baf7103a5b6149b0c70d8a2677bf2baaa0fc`；需要回復時以 revert 本版提交處理，不重置同儲存庫其他專案。
