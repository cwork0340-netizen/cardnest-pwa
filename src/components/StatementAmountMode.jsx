function fmt(n) {
  return 'NT$' + Number(n).toLocaleString()
}

export default function StatementAmountMode({ carriedIn, mode, onChange }) {
  if (!(carriedIn > 0)) return null
  return (
    <fieldset className="statement-mode">
      <legend>上期還有 {fmt(carriedIn)} 沒繳，你填的是帳單上的哪個數字？銀行電子帳單信上寫的「本期應繳總額」是第二個。</legend>
      <label>
        <input type="radio" name="statement-mode" checked={mode === 'new'} onChange={() => onChange('new')} />
        本期新增消費（不含上期未繳）
      </label>
      <label>
        <input type="radio" name="statement-mode" checked={mode === 'total'} onChange={() => onChange('total')} />
        本期應繳總額（已含上期未繳 {fmt(carriedIn)}，會併成這一張帳單）
      </label>
    </fieldset>
  )
}
