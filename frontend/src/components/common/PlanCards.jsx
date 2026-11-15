import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getPlans } from '../../services/plan.service';
import { formatToman } from '../../utils/format';
import Skeleton from './Skeleton';

export default function PlanCards() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPlans()
      .then((data) => {
        if (mounted) setPlans(data || []);
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.error?.message || 'خطا در بارگذاری پلن‌ها');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleBuy = (planId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/checkout/${planId}` } });
    } else {
      navigate(`/checkout/${planId}`);
    }
  };

  if (loading) {
    return (
      <div className="plan-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="plan-card">
            <Skeleton height="1.5rem" width="60%" />
            <Skeleton height="2rem" width="40%" />
            <Skeleton height="1rem" count={4} />
            <Skeleton height="2.5rem" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="alert alert--error">{error}</div>;
  }

  if (!plans.length) {
    return <div className="empty-state">در حال حاضر پلنی موجود نیست.</div>;
  }

  const middleIndex = Math.floor(plans.length / 2);

  return (
    <div className="plan-grid">
      {plans.map((plan, i) => {
        const popular = i === middleIndex && plans.length > 1;
        return (
          <div key={plan.id} className={`plan-card${popular ? ' plan-card--popular' : ''}`}>
            {popular && <div className="plan-card__badge">محبوب‌ترین</div>}
            <h3 className="plan-card__name">{plan.name}</h3>
            {plan.description && <p className="plan-card__desc">{plan.description}</p>}
            <div className="plan-card__price">
              <span className="plan-card__amount">{formatToman(plan.priceToman)}</span>
              <span className="plan-card__duration">/ {plan.durationDays} روز</span>
            </div>
            <ul className="plan-card__features">
              {(plan.features || []).map((f, fi) => (
                <li key={fi}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button className={`btn btn--block ${popular ? 'btn--primary' : 'btn--outline'}`} onClick={() => handleBuy(plan.id)}>
              خرید
            </button>
          </div>
        );
      })}
    </div>
  );
}
