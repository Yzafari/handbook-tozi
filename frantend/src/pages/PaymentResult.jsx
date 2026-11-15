import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getPayment } from '../services/payment.service';
import { formatToman, formatJalaliDate } from '../utils/format';
import Loader from '../components/common/Loader';
import { useAuth } from '../hooks/useAuth';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  const queryStatus = searchParams.get('status');
  const paymentId = searchParams.get('paymentId');
  const callbackMessage = searchParams.get('message');

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/payment/result?status=${queryStatus || ''}&paymentId=${paymentId || ''}` } });
      return;
    }
    if (!paymentId) {
      setError(callbackMessage || (queryStatus === 'failed' ? 'پرداخت ناموفق بود یا نتیجه آن قابل بازیابی نیست.' : 'شناسه پرداخت یافت نشد.'));
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getPayment(paymentId)
      .then((data) => {
        if (!mounted) return;
        setPayment(data?.payment || data);
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.error?.message || 'خطا در دریافت اطلاعات پرداخت.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isLoading, isAuthenticated, paymentId, queryStatus, callbackMessage, navigate]);

  if (isLoading || loading) {
    return (
      <div className="page-loader">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container section payment-result">
        <div className="payment-result__icon payment-result__icon--fail">✕</div>
        <h1 className="payment-result__title">خطا</h1>
        <p className="payment-result__msg">{error}</p>
        <div className="payment-result__actions">
          <Link to="/pricing" className="btn btn--primary">
            بازگشت به پلن‌ها
          </Link>
          <Link to="/dashboard" className="btn btn--outline">
            داشبورد
          </Link>
        </div>
      </div>
    );
  }

  const isSuccess = payment?.status === 'SUCCESS';

  if (!isSuccess) {
    return (
      <div className="container section payment-result">
        <div className="payment-result__icon payment-result__icon--fail">✕</div>
        <h1 className="payment-result__title">پرداخت ناموفق</h1>
        <p className="payment-result__msg">
          {payment?.failureReason || 'پرداخت شما انجام نشد. در صورت کسر مبلغ، طی ۷۲ ساعت آینده بازگردانده می‌شود.'}
        </p>
        {payment && (
          <dl className="payment-result__details">
            <div>
              <dt>شناسه پرداخت</dt>
              <dd>{payment.id}</dd>
            </div>
            <div>
              <dt>مبلغ</dt>
              <dd>{formatToman(payment.amountToman)}</dd>
            </div>
          </dl>
        )}
        <div className="payment-result__actions">
          <Link to="/pricing" className="btn btn--primary">
            تلاش مجدد
          </Link>
          <Link to="/dashboard" className="btn btn--outline">
            داشبورد
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section payment-result">
      <div className="payment-result__icon payment-result__icon--success">✓</div>
      <h1 className="payment-result__title">پرداخت موفق</h1>
      <p className="payment-result__msg">اشتراک شما با موفقیت فعال شد.</p>
      <dl className="payment-result__details">
        <div>
          <dt>مبلغ</dt>
          <dd>{formatToman(payment.amountToman)}</dd>
        </div>
        {payment.planName && (
          <div>
            <dt>پلن</dt>
            <dd>{payment.planName}</dd>
          </div>
        )}
        {payment.refId && (
          <div>
            <dt>شماره پیگیری</dt>
            <dd>{payment.refId}</dd>
          </div>
        )}
        {payment.verifiedAt && (
          <div>
            <dt>تاریخ</dt>
            <dd>{formatJalaliDate(payment.verifiedAt)}</dd>
          </div>
        )}
      </dl>
      <div className="payment-result__actions">
        <Link to="/dashboard" className="btn btn--primary btn--lg">
          رفتن به داشبورد
        </Link>
      </div>
    </div>
  );
}