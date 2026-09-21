# 新北市區間平均速率執法設備

來源：https://data.gov.tw/dataset/126156 ，新北市政府警察局；政府資料開放授權條款第1版，免費。

官方14列資料有部分列包含多組座標；依官方各座標欄的相同順序、相同陣列長度配對，匯入25組區間、50個起訖點，未排除有效點。保留 directionText 原文。雙向、東向等描述不轉成猜測 heading，UI會保留方向未知。

fetchedAt 是本次匯入時間，不是官方更新時間；原始資料沒有逐筆更新時間，lastUpdated=null。來源下載網址和原始內容 SHA-256 存於JSON。

publishedLength 僅在官方欄位為單一明確公尺值時填入；複數方向／匝道長度原文保留為lengthText，不猜配對長度。counterpart 表示官方座標列對應點，不代表道路幾何、實際可行路線或當前行進方向。本版沒有區間平均速率計算，不宣稱全臺涵蓋。

重新匯入：在repository root執行 `node geodeck/scripts/import-enforcement-sections.mjs`，或加上已下載官方CSV路徑。下載失敗不會覆蓋快照。座標陣列長度不符或缺必要欄位時拒絕猜測。
