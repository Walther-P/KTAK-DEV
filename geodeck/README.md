# GeoDeck 0.7.2 — Google 地圖與停車輔助

網站：https://walther-p.github.io/KTAK-DEV/geodeck/ 。設定頁可確認版本 **0.7.2**；既有主畫面捷徑可按「檢查更新」。

GeoDeck 整理地點的環境與停車資訊，再交給導航 App 計算路線。台灣預設 Google Maps、韓國預設 NAVER，也可手動切換。GeoDeck 不計算最快路線或班次，也無法讀取另一個 App 的路線。

## 本版行為

- Google Maps 深色底圖，沿用原專案受網址限制的瀏覽器金鑰。
- 按 P 直接在目前可見範圍顯示停車標記，不移動地圖、不先開清單；拖動地圖更新範圍。點個別標記才看計費、開放時間、容量、來源與導航入口。
- 停車場詳情僅對已核對拍得到入口／內部的鏡頭顯示觀看按鈕，否則顯示「附近無拍攝監視器」。不依距離或名稱猜測拍摄範圍。初始已核對冷水坑1號停車場入口，其他場站需取得證據後逐筆加入。返回詳情或導航都保留停車場與原目的地。
- 全台及離島的公開停車目錄，目前 69,723 個位置記錄，含停車場、路邊與個別車格。收錄不代表完整實地清冊，也不代表都有即時空位。
- 標記數字表示有來源時間的剩餘格數；? 表示未知或過期；~ 表示來源回報數量但未提供更新時間；N 處是合併的地點數，不是空位總數。超過五分鐘不沿用空位數。
- 逐時天氣同時顯示降雨機率（%）及降水量（mm，該時刻前一小時的模式預報，包含雪水當量）；缺值顯示未知。
- 保留雷達、雲圖、AQI、台灣監視器、地震、搜尋、收藏、備註、停車位置與導航交接。
- PWA 可離線讀收藏及備註。Google 底圖、搜尋、天氣與即時車位需要網路，沒有離線底圖、背景定位、鎖屏提醒或測速提醒。

## 費用與資料界線

Google JavaScript 地圖使用原專案的共用額度，不會自動使用每位訪客自己的 Google 額度。沒有啟用 Google Places 或 Routes API；導航使用 Maps URLs / NAVER URL scheme。**本版未確認 Google 專案有能保證零費用的硬性配額，不能承諾 Google 底圖永遠免費**；恢復原金鑰沒有修改帳單或購買服務。

停車公開資料轉接使用既有 Supabase 免費方案，沒有新增付費方案。端點只讀固定政府來源，快取並合併同時請求，不存使用者位置或讀取資料庫。公開金鑰用於辨識專案，不是使用者身分驗證。部署原始碼位於 backend/geodeck-parking/；伺服器只接受預設來源，跨來源允許原網站及本機預覽。

沒有 TDX 金鑰，沒有宣稱全台即時車位已串完。台北、台南有来源更新時間；新北、桃園可取得部分場站回報數量但未提供來源時間；台中目前來源未提供數量。其他地區以位置目錄為主。新北路邊格位的狀態代碼缺少官方定義，因此僅顯示位置與公開費率，不猜測空位。詳見 [資料來源](data/PARKING.md)。

Photon 搜尋、Open-Meteo 與其他開放來源仍受各自合理用量及非商業條款限制。沒有以付費服務作自動備援。真實 iPhone 的定位授權、主畫面更新及外部導航跳轉需要實機確認。

## 模組與資料更新

- map-provider.js：Google 底圖、DOM 標記與影像圖層介面；maplibre-provider.js 保留先前介面作參考，未載入。
- parking-map-ui.js / parking-core.js：地圖停車互動、有效時間、群聚及去重。
- parking-catalog.js / parking-sources.js：可見範圍分區目錄、官方來源正規化、即時資料補充。
- data/parking/：分區位置目錄及 ODbL 授權說明。程式不向 Overpass 逐人即時搜尋全台。
- journey.js / navigation-ui.js：地區推薦、外部導航、目的地與停車行程。
- weather-core.js：逐時雨量格式化；app.js 取得 Open-Meteo 預報。
- camera-catalog.js：共享本站監視器目錄快照，影像仍連線讀取；data/parking-cameras.json 僅收錄有來源證據及人工核對的停車場關聯。影像網址更換或核對超過 90 天需重新核對。YouTube 來源先顯示直播縮圖，可按「在原站觀看」播放官方直播。

在儲存庫根目錄執行：

```sh
node --test geodeck/tests/*.test.js
node geodeck/scripts/preview.mjs
node geodeck/scripts/refresh-parking-catalog.mjs
```

最後一個命令重新下載官方公開資料及一次 OSM 台灣資料，再產生分區目錄。僅重建已下載的資料可執行 build-parking-catalog.mjs；下載檔放在忽略的 qa/。目錄不含即時剩餘數。

設定 PLAYWRIGHT_PATH 後執行 scripts/smoke-google.cjs（從儲存庫根目錄）。BROWSER_ENGINE=webkit 使用 WebKit，預設 Chromium 使用本機 Edge。此測試在原網站授權來源攔截自己的靜態檔案以測試未發布程式，Google 及公開資料服務使用真實回應，不放寬金鑰限制。check-offline.cjs 在已發布版本驗證圖層與 PWA 離線收藏；GEODECK_URL 可覆寫測試網址。smoke.cjs 保留為新版測試入口。

0.7 起點為 099634f9d1a77c5f879034d0b825a436d86d042a。回復應 revert 本版提交，勿重置同儲存庫其他專案。更早實作見 README-0.5.md。
