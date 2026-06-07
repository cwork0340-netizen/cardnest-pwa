import './Onboarding.css'

export default function Onboarding({ onStart }) {
  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <img
          className="onboarding-hero"
          src="/hero-illustration.png"
          alt=""
          aria-hidden="true"
        />
        <h1 className="onboarding-title">CardNest</h1>
        <p className="onboarding-subtitle">信用卡帳務小窩</p>
        <p className="onboarding-desc">
          多卡管理、訂閱追蹤、分期付款<br />
          讓帳務變得安心清楚
        </p>
        <button className="onboarding-btn" onClick={onStart}>
          新增我的第一張卡
        </button>
        <p className="onboarding-hint">設定好第一張卡就可以開始記帳囉</p>
      </div>
    </div>
  )
}
