import { resolveCardId, toISODate } from './financeData'

// 記一筆表單 → 交易欄位。刷卡頁與現況的「＋」共用，兩邊記出來的交易必須一模一樣。
export function buildManualTransactionFields({ amount, isRefund, category, cardId, card, date, postedDate, name, note }, cards) {
  const selectedCard = cards.find((c) => c.id === (cardId || resolveCardId({ card }, cards)))
  return {
    name: name.trim() || (isRefund ? '退款' : category),
    category,
    kind: isRefund ? 'refund' : undefined,
    cardId: selectedCard?.id,
    card: selectedCard?.name ?? card,
    amount,
    date: toISODate(date),
    ...(postedDate ? { postedDate: toISODate(postedDate) } : { postedDate: undefined }),
    note,
  }
}
