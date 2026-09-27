# 停車資料來源與涵蓋

2026-09-27 取得的目錄有 **69,723 個位置記錄**，分成 89 個 0.25° 區塊，按可見範圍載入。涵蓋全台 22 縣市及離島；這是公開資料的收錄範圍，不是所有實際停車場／車格的完整清冊。記錄包含停車場及個別格位，不能把總記錄數當成停車場總數。

| 來源 | 目錄記錄 | 即時數量 |
|---|---:|---|
| OpenStreetMap | 34,680 | 無 |
| 臺北市 | 1,203 | 有提供的場站，附來源更新時間 |
| 臺南市 | 268 | 有提供的場站／路邊路段，附來源更新時間 |
| 新北市停車場 | 1,321 | 部分場站有回報數量，沒有來源更新時間 |
| 新北市路邊格位 | 30,653 | 狀態代碼未採用，空位未知 |
| 桃園市 | 245 | 部分場站有回報數量，沒有來源更新時間 |
| 臺中市 | 1,353 | 來源只有狀態顏色等欄位，沒有剩餘數量 |

來源刷新時可增加或減少有效位置。容量不是剩餘數；不同種類車位不可混算。群聚顯示「處」表示地點記錄數；點選放大後才顯示個別數量。

## 來源連結

- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，ODbL 1.0；Overpass 台灣行政區資料擷取：amenity=parking、parking_space 及已標註路邊停車的道路。排除 access=private/no、motorcar=no、廢棄記錄；位置可能是幾何中心，未必是入口。
- [臺北市停車資料](https://data.gov.tw/dataset/128435)，目錄 TCMSV_alldesc.json／數量 TCMSV_allavailable.json，主機 tcgbusfs.blob.core.windows.net/blobtcmsv。EntranceCoord 的 Xcod 為緯度、Ycod 為經度，來源 CST 解析為 UTC+8。
- [臺南市政府交通局](https://data.tainan.gov.tw/Resource/91073f40-d251-42cc-9f4c-88e8937c9911)，API 位於 soa.tainan.gov.tw/Api/Service/Get/ 同一識別碼。lnglat 是緯度、經度；car 是剩餘小型車數、car_total 是容量。update_time 使用 UTC+8。
- [新北市停車場目錄](https://data.ntpc.gov.tw/datasets/b1464ef0-9c7c-4a6f-abf7-6bdf32847e68)、[剩餘數量](https://data.ntpc.gov.tw/datasets/e09b35a5-a738-48cc-b0f5-570b67ad9c78)、[路邊格位](https://data.ntpc.gov.tw/datasets/54a507c4-c038-41b5-bf60-bbecb9d052c6)。場站 TWD97/TM2 zone 121 轉 WGS84；路邊保留公開座標及費率。parkingstatus、cellstatus 的碼值缺少明確定義，不能擅自視為空／滿。
- [桃園市停車場](https://data.gov.tw/dataset/25940)，surplusSpace 是回報數量，wgsX 是緯度、wgsY 是經度；沒有資料時間。
- [臺中市停車場](https://data.gov.tw/dataset/83931)，motoretag.taichung.gov.tw/DataAPI/api/ParkingAPIV2/Opendata。TotalCar 是容量；不把 RGB 顏色換算成空位數。
- 政府資料按來源標示之[政府資料開放授權條款第 1 版](https://data.gov.tw/license)使用並保留出處；OSM 衍生合併目錄見 [授權說明](parking/LICENSE.md)。

## 更新與有效時間

- 有來源時間且五分鐘內：顯示確切剩餘數，0 是滿位；過期或未來時間顯示 ?。
- 有數量但沒有來源時間：標示 ~ 及「來源回報、未提供更新時間」，分開顯示讀取時間。讀取超過五分鐘不繼續使用。
- 空白、缺值、布林、負數或格式錯誤：未知，不是零。
- 開啟停車圖層時按可見範圍載入；地圖停止移動後更新，前景每分鐘刷新。隱藏頁面停止刷新。來源失敗保留位置目錄並顯示提示。
- 靜態分區不保存 available、lastUpdated 或 fetchedAt。index.json 的 fetchedAt 僅表示目錄整理時間，osmTimestamp 是 OSM 資料庫快照時間，不冒充個別空位更新時間。
- 臺北、臺南直接讀取官方允許跨來源的資料；新北、桃園、臺中透過只讀公開資料代理，僅允許固定來源，不接受任意 URL。免費 Supabase 未作付費升級。
- 尚無 TDX 憑證；不以有限的匿名入口冒充穩定全台即時服務。未提供即時數量的地區仍能查到已收錄的位置。

使用 scripts/refresh-parking-catalog.mjs 可重新下載並建立目錄，scripts/build-parking-catalog.mjs 可用已有的 qa/ 下載重建。分頁去重但官方資料可能在擷取期間變動，因此不保證逐格完整。台南原有 data/parking-tainan.json 保留作官方連線失敗的目錄備援。
