import { fireEvent, screen } from '@testing-library/react'

// 測試走到某一頁的唯一入口。導覽改版時只改這個檔案，不必逐個改測試。
// 導覽列有三格：現況、刷卡、更多；各卡與帳單、規劃、設定在「更多」裡。
// 舊的「總覽」頁現在叫「各卡與帳單」。
const DIRECT = new Set(['現況', '刷卡'])
const UNDER_MORE = new Set(['各卡與帳單', '規劃', '設定'])
const ALIAS = { 總覽: '各卡與帳單' }

const press = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }))

export function goTo(rawPage) {
  const page = ALIAS[rawPage] ?? rawPage
  if (DIRECT.has(page)) return press(page)
  if (UNDER_MORE.has(page)) {
    press('更多')
    return press(page)
  }
  throw new Error(`goTo: 不認得的頁面「${page}」`)
}
