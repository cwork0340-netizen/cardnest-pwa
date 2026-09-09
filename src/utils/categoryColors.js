// 分類顏色只能有一份。以前 App.jsx 有一個空的 CATEGORY_COLORS，所以首頁圓餅圖
// 每一塊都拿到同一個 fallback 灰——畫出來是一個看不出分界的灰色圓；
// 而刷卡列表另外有一份真的調色盤。兩邊各自為政，其中一邊還是空的。

const NAMED = {
  餐飲: '#A98274',
  購物: '#D6A04D',
  訂閱: '#8DAA91',
  日常: '#B98D6F',
  交通: '#C86E62',
  娛樂: '#7C93B8',
  保險: '#9C7BA8',
  醫療: '#6FA37C',
  其他: '#B9ADA6',
}

// 分類是使用者自己打的字，不可能列舉完。沒列到的就從這裡挑一個穩定的顏色，
// 而不是全部退回同一個灰——否則圓餅圖又會變回一坨。
// 這組刻意跟 NAMED 不重疊：若共用同一批色，自訂分類會雜湊到跟「餐飲」一樣的顏色，
// 在同一張圓餅圖上冒充成另一個分類。
const PALETTE = [
  '#8E6E5B', '#C9B037', '#5F8C7D', '#A5647E',
  '#6B7FA3', '#B07C4A', '#7A8B5C', '#92709B',
]

// 用名稱雜湊挑色，不用排名——這樣同一個分類的顏色不會因為這個月花多花少
// 排序變了就跟著換，月月對照才有意義。
function hashIndex(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return hash % PALETTE.length
}

export function categoryColor(name) {
  const key = String(name ?? '').trim()
  if (!key) return NAMED.其他
  return NAMED[key] ?? PALETTE[hashIndex(key)]
}
