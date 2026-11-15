import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PlanCards from '../components/common/PlanCards';

const features = [
  {
    title: 'امنیت بالا',
    desc: 'رمزنگاری پیشرفته و احراز هویت چندلایه برای محافظت از داده‌های شما',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'پرداخت آسان',
    desc: 'درگاه پرداخت امن زرین‌پال با پشتیبانی از تمامی کارت‌های بانکی',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    title: 'پشتیبانی ۲۴/۷',
    desc: 'تیم پشتیبانی ما در تمام ساعات شبانه‌روز آماده کمک به شماست',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: 'دسترسی سریع',
    desc: 'در هر زمان و مکان به حساب کاربری و اشتراک خود دسترسی داشته باشید',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: 'مدیریت آسان',
    desc: 'داشبورد کاربری ساده و کامل برای مدیریت اشتراک و پرداخت‌ها',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    title: 'گزارش‌های دقیق',
    desc: 'تاریخچه کامل پرداخت‌ها و اشتراک‌ها با جزئیات دقیق',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const steps = [
  { num: '۱', title: 'ثبت‌نام کنید', desc: 'در کمتر از یک دقیقه حساب کاربری بسازید' },
  { num: '۲', title: 'پلن انتخابی', desc: 'پلن مناسب نیاز خود را انتخاب و پرداخت کنید' },
  { num: '۳', title: 'شروع استفاده', desc: 'بلافاصله از تمام امکانات بهره‌مند شوید' },
];

const faqs = [
  { q: 'آیا امکان لغو اشتراک وجود دارد؟', a: 'بله، در هر زمان می‌توانید اشتراک خود را لغو کنید. تا پایان دوره فعال باقی می‌ماند.' },
  { q: 'روش‌های پرداخت کدامند؟', a: 'پرداخت از طریق درگاه امن زرین‌پال و تمامی کارت‌های بانکی عضو شتاب انجام می‌شود.' },
  { q: 'آیا فاکتور صادر می‌شود؟', a: 'بله، پس از هر پرداخت موفق فاکتور الکترونیکی در داشبورد شما قابل مشاهده است.' },
  { q: 'امکان تغییر پلن وجود دارد؟', a: 'بله، با خرید پلن جدید، مدت باقی‌مانده به اشتراک جدید اضافه می‌شود.' },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero__bg" aria-hidden="true" />
        <div className="container hero__content">
          <h1 className="hero__title">
            اشتراک هوشمند،
            <br />
            <span className="hero__gradient">تجربه‌ای متفاوت</span>
          </h1>
          <p className="hero__subtitle">
            با پلن‌های انعطاف‌پذیر ما، به تمام امکانات دسترسی داشته باشید. امن، سریع و مقرون‌به‌صرفه.
          </p>
          <div className="hero__actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn--primary btn--lg">
                ورود به داشبورد
              </Link>
            ) : (
              <Link to="/register" className="btn btn--primary btn--lg">
                شروع کنید
              </Link>
            )}
            <a href="#pricing" className="btn btn--outline btn--lg">
              مشاهده پلن‌ها
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">چرا ما؟</h2>
          <p className="section__subtitle">امکاناتی که تجربه شما را بهبود می‌بخشد</p>
          <div className="feature-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="feature-card__icon">{f.icon}</div>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">چگونه کار می‌کند</h2>
          <p className="section__subtitle">در سه قدم ساده شروع کنید</p>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={i} className="step">
                <div className="step__num">{s.num}</div>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section" id="pricing">
        <div className="container">
          <h2 className="section__title">پلن‌های اشتراک</h2>
          <p className="section__subtitle">پلن مناسب خود را انتخاب کنید</p>
          <PlanCards />
        </div>
      </section>

      {/* FAQ */}
      <section className="section section--alt">
        <div className="container container--narrow">
          <h2 className="section__title">سوالات متداول</h2>
          <div className="faq">
            {faqs.map((f, i) => (
              <div key={i} className={`faq__item${openFaq === i ? ' faq__item--open' : ''}`}>
                <button className="faq__q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span>{f.q}</span>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className="faq__a">
                  <p>{f.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section cta-final">
        <div className="container cta-final__inner">
          <h2>همین حالا شروع کنید</h2>
          <p>به هزاران کاربر راضی بپیوندید</p>
          <button
            className="btn btn--primary btn--lg"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
          >
            {isAuthenticated ? 'رفتن به داشبورد' : 'ثبت‌نام رایگان'}
          </button>
        </div>
      </section>
    </div>
  );
}