import { fireEvent, screen } from '@testing-library/react'

// 測試走到某一頁的唯一入口。導覽改版時只改這個檔案，不必逐個改測試。
// 導覽列有三格：總覽、刷卡、更多；規劃與設定在「更多」裡。
const DIRECT = new Set(['總覽', '刷卡'])
const UNDER_MORE = new Set(['規劃', '設定'])

const press = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }))

export function goTo(page) {
  if (DIRECT.has(page)) return press(page)
  if (UNDER_MORE.has(page)) {
    press('更多')
    return press(page)
  }
  throw new Error(`goTo: 不認得的頁面「${page}」`)
}
