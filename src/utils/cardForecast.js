// commitments（畫面上的「固定」）必須是「這個月已知會扣、但還沒有對應刷卡記錄」的金額，
// 不能是「所有訂閱＋分期的總額」。因為它跟 currentCyclePurchases（本月已經刷掉的）
// 一起從收入裡扣：訂閱一旦扣款、銀行信件匯入成一筆真實交易，就已經算在
// currentCyclePurchases 裡了，再加一次計畫金額等於同一筆錢扣兩次。
//
// 這個數字 App.jsx 已經算好（fixedMonthlyAmount），用的是跟首頁同一套
// planAmountNotRecorded / installmentAmountNotRecordedInWindow，所以直接傳進來，
// 不要在這裡開第二種算法——這個專案已經被「同一個概念算兩次」咬過好幾次。
export function buildCardForecast(cards = [], { income = 0, essentialTotal = 0, commitments = 0 } = {}) {
  const perCard = cards.map((card) => ({
    id: card.id,
    name: card.name,
    color: card.color,
    statementDue: Number(card.unpaidTotal || 0),
    nextEstimate: Number(card.spendingWarningTotal ?? (
      Number(card.currentCycleAmount || 0)
      + Number(card.subsOnCard || 0)
      + Number(card.instOnCard || 0)
    )),
  }))

  const statementDue = perCard.reduce((total, card) => total + card.statementDue, 0)
  const currentCyclePurchases = cards.reduce((total, card) => total + Number(card.currentCyclePurchaseAmount ?? card.currentCycleAmount ?? 0), 0)
  const nextEstimate = perCard.reduce((total, card) => total + card.nextEstimate, 0)
  const fixedCommitments = Number(commitments) || 0

  return {
    statementDue,
    nextEstimate,
    commitments: fixedCommitments,
    currentCyclePurchases,
    hasIncome: Number(income) > 0,
    safeToSpend: Math.max(0, Number(income) - Number(essentialTotal) - statementDue - currentCyclePurchases - fixedCommitments),
    overCommitted: Math.max(0, Number(essentialTotal) + statementDue + currentCyclePurchases + fixedCommitments - Number(income)),
    perCard,
  }
}
