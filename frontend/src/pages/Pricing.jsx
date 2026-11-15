import { useState, useEffect } from 'react';
import PlanCards from '../components/common/PlanCards';
import { getPlans } from '../services/plan.service';
import { formatToman } from '../utils/format';

const faqs = [
  { q: 'آیا امکان لغو اشتراک وجود دارد؟', a: 'بله، در هر زمان می‌توانید اشتراک خود را لغو کنید و تا پایان دوره فعال باقی می‌ماند.' },
  { q: 'روش‌های پرداخت کدامند؟', a: 'پرداخت از طریق درگاه امن زرین‌پال و تمامی کارت‌های بانکی عضو شتاب.' },
  { q: 'امکان تغییر پلن وجود دارد؟', a: 'با خرید پلن جدید، مدت باقی‌مانده به اشتراک جدید اضافه می‌شود.' },
  { q: 'آیا فاکتور صادر می‌شود؟', a: 'بله، فاکتور الکترونیکی در داشبورد شما قابل مشاهده است.' },
];

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    let mounted = true;
    getPlans()
      .then((data) => {
        if (mounted) setPlans(data || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const unionFeatures = [];
  plans.forEach((p) => {
    (p.features || []).forEach((f) => {
      if (!unionFeatures.includes(f)) unionFeatures.push(f);
    });
  });

  return (
    <div className="pricing-page">
      <section className="section">
        <div className="container">
          <h1 className="section__title">پلن‌های اشتراک</h1>
          <p className="section__subtitle">پلن مناسب خود را انتخاب کنید</p>
          <PlanCards />
        </div>
      </section>

      {plans.length > 0 && unionFeatures.length > 0 && (
        <section className="section section--alt">
          <div className="container">
            <h2 className="section__title">مقایسه امکانات</h2>
            <div className="table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>امکانات</th>
                    {plans.map((p) => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unionFeatures.map((f, fi) => (
                    <tr key={fi}>
                      <td>{f}</td>
                      {plans.map((p) => (
                        <td key={p.id} className="compare-table__cell">
                          {(p.features || []).includes(f) ? (
                            <span className="compare-table__yes">✔</span>
                          ) : (
                            <span className="compare-table__no">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td>قیمت</td>
                    {plans.map((p) => (
                      <td key={p.id}>{formatToman(p.priceToman)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>مدت</td>
                    {plans.map((p) => (
                      <td key={p.id}>{p.durationDays} روز</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="section">
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
    </div>
  );
}