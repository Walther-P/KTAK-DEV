# KTAK V2.1 DEV1 — Google Maps 底圖

此版只做地圖引擎第一階段，不改其他 V2.0 功能。

架構：
- Google Maps JavaScript API：視覺底圖
- Leaflet：保留現有 KTAK 戰術圖樣、線條、方形、圓形、自由畫、照片、拖曳、備註、方向扇形
- Google 載入失敗：自動切回 OpenStreetMap
- 使用者可手動在 Google / OSM 間切換
- 道路圖 / 衛星圖切換在兩個底圖引擎都保留

注意：
- config.js 必須已有 GOOGLE_MAPS_API_KEY
- 這一版尚未加入每月 Google Maps 自訂使用量硬限制；那會在下一階段用 DEV Supabase 做 server-side usage gate
- 地址搜尋目前仍沿用原本 Nominatim，避免同時再新增 Geocoding API 造成變更範圍過大
