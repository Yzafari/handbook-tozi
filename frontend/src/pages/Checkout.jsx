import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlans } from '../services/plan.service';
import { requestPayment } from '../services/payment.service';
import { formatToman, formatJalaliDate } from '../utils/format';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import { useToast } from '../hooks/useToast';

function getOrCreateIdempotencyKey(planId, amountToman) {
  const storageKey = `gh_idem_${planId}_${amountToman}`;

  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export default function Checkout() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    let mounted = true;
    setLoading(true);
    getPlans()
      .then((plans) => {
        if (!mounted) return;
        const found = (plans || []).find((p) => p.id === planId);
        if (!found) {
          setError('پلن مورد نظر یافت نشد.');
        } else {
          setPlan(found);
        }
      })
      .catch(() => {
        if (mounted) setError('خطا در بارگذاری اطلاعات پلن.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [planId]);

  const computeEndDate = useCallback(() => {
    if (!plan) return null;
    const d = new Date();
    d.setDate(d.getDate() + plan.durationDays);
    return d;
  }, [plan]);

  const handleConfirm = async () => {
    if (submittingRef.current || !plan) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const idempotencyKey = getOrCreateIdempotencyKey(plan.id);
      const result = await requestPayment({ planId: plan.id, idempotencyKey });
      if (result?.paymentUrl) {
        try {
          sessionStorage.removeItem(`gh_idem_${plan.id}`);
        } catch {}
        window.location.assign(result.paymentUrl);
      } else {
        toast.error('خطا در ایجاد درخواست پرداخت.');
        submittingRef.current = false;
        setSubmitting(false);
      }
    } catch (err) {
      try { sessionStorage.removeItem(`gh_idem_${plan.id}`); } catch {}
      toast.error(err?.response?.data?.error?.message || 'خطا در ایجاد درخواست پرداخت.');
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loader">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container section">
        <div className="alert alert--error">{error}</div>
        <button className="btn btn--outline" onClick={() => navigate('/pricing')}>
          بازگشت به پلن‌ها
        </button>
      </div>
    );
  }

  const endDate = computeEndDate();

  return (
    <div className="checkout-page container section">
      <h1 className="section__title">تأیید سفارش</h1>
      <div className="checkout-summary">
        <h2>{plan.name}</h2>
        {plan.description && <p className="checkout-summary__desc">{plan.description}</p>}
        <dl className="checkout-summary__list">
          <div>
            <dt>مبلغ</dt>
            <dd>{formatToman(plan.priceToman)}</dd>
          </div>
          <div>
            <dt>مدت اشتراک</dt>
            <dd>{plan.durationDays} روز</dd>
          </div>
          {endDate && (
            <div>
              <dt>تاریخ پایان تقریبی</dt>
              <dd>{formatJalaliDate(endDate)}</dd>
            </div>
          )}
        </dl>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => setShowModal(true)} disabled={submitting}>
          ادامه و پرداخت
        </button>
      </div>

      <Modal open={showModal} onClose={() => !submitting && setShowModal(false)} title="تأیید پرداخت">
        <p>
          آیا مبلغ <strong>{formatToman(plan.priceToman)}</strong> برای پلن <strong>{plan.name}</strong> را تأیید می‌کنید؟
        </p>
        <div className="modal__actions">
          <button className="btn btn--outline" onClick={() => setShowModal(false)} disabled={submitting}>
            انصراف
          </button>
          <button className="btn btn--primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'در حال انتقال...' : 'تأیید و پرداخت'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
