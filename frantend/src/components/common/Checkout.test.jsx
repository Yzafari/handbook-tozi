import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Checkout from '../../pages/Checkout';
import * as planService from '../../services/plan.service';
import * as paymentService from '../../services/payment.service';

const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
vi.mock('../../hooks/useToast', () => ({ useToast: () => mockToast }));

vi.mock('../../services/plan.service', () => ({ getPlans: vi.fn() }));
vi.mock('../../services/payment.service', () => ({ requestPayment: vi.fn() }));

const plan = {
  id: 'plan-1',
  name: 'حرفه‌ای',
  description: 'پلن تست',
  priceToman: 250000,
  durationDays: 90,
  features: ['الف', 'ب'],
};

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout/plan-1']}>
      <Routes>
        <Route path="/checkout/:planId" element={<Checkout />} />
        <Route path="/pricing" element={<div>Pricing Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    planService.getPlans.mockResolvedValue([plan]);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('displays amount from the API plan', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('حرفه‌ای')).toBeInTheDocument());
    expect(screen.getByText('۲۵۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('90 روز')).toBeInTheDocument();
  });

  it('does not use client-supplied price but the API plan', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('حرفه‌ای')).toBeInTheDocument());
    expect(planService.getPlans).toHaveBeenCalled();
    expect(screen.queryByText('۰ تومان')).not.toBeInTheDocument();
    expect(screen.getByText('۲۵۰٬۰۰۰ تومان')).toBeInTheDocument();
  });

  it('redirects to paymentUrl after confirm', async () => {
    const assignMock = vi.fn();
    const originalLocation = window.location;
    delete window.location;
    window.location = { assign: assignMock };

    paymentService.requestPayment.mockResolvedValue({
      paymentId: 'pay-1',
      paymentUrl: 'https://gateway.example/pay/1',
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByText('حرفه‌ای')).toBeInTheDocument());
    fireEvent.click(screen.getByText('ادامه و پرداخت'));
    await waitFor(() => expect(screen.getByText('تأیید و پرداخت')).toBeInTheDocument());
    fireEvent.click(screen.getByText('تأیید و پرداخت'));

    await waitFor(() => {
      expect(paymentService.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ planId: 'plan-1' })
      );
    });
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://gateway.example/pay/1'));

    window.location = originalLocation;
  });

  it('passes an idempotency key', async () => {
    paymentService.requestPayment.mockResolvedValue({
      paymentId: 'pay-1',
      paymentUrl: 'https://gateway.example/pay/1',
    });
    const assignMock = vi.fn();
    const originalLocation = window.location;
    delete window.location;
    window.location = { assign: assignMock };

    renderCheckout();
    await waitFor(() => expect(screen.getByText('حرفه‌ای')).toBeInTheDocument());
    fireEvent.click(screen.getByText('ادامه و پرداخت'));
    await waitFor(() => expect(screen.getByText('تأیید و پرداخت')).toBeInTheDocument());
    fireEvent.click(screen.getByText('تأیید و پرداخت'));

    await waitFor(() => {
      const arg = paymentService.requestPayment.mock.calls[0][0];
      expect(arg.idempotencyKey).toBeTruthy();
      expect(arg.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    });

    window.location = originalLocation;
  });

  it('shows toast error when requestPayment fails', async () => {
    paymentService.requestPayment.mockRejectedValue({
      response: { data: { error: { message: 'پرداخت ناموفق' } } },
    });
    renderCheckout();
    await waitFor(() => expect(screen.getByText('حرفه‌ای')).toBeInTheDocument());
    fireEvent.click(screen.getByText('ادامه و پرداخت'));
    await waitFor(() => expect(screen.getByText('تأیید و پرداخت')).toBeInTheDocument());
    fireEvent.click(screen.getByText('تأیید و پرداخت'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('پرداخت ناموفق'));
  });
});