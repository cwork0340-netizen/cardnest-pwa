function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

export default function StatementAmountMode({ carriedIn, mode, onChange }) {
  if (!(carriedIn > 0)) return null
  return (
    <fieldset className="statement-mode">
      <legend>上期還有 {fmt(carriedIn)} 沒繳，你填的是帳單上的哪個數字？</legend>
      <label>
        <input type="radio" name="statement-mode" checked={mode === 'new'} onChange={() => onChange('new')} />
        本期新增消費（不含上期未繳）
      </label>
      <label>
        <input type="radio" name="statement-mode" checked={mode === 'total'} onChange={() => onChange('total')} />
        本期應繳總額（含上期未繳，App 會自動扣掉 {fmt(carriedIn)}）
      </label>
    </fieldset>
  )
}
