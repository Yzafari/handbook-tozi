import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PaymentResult from './PaymentResult';
import * as paymentService from '../services/payment.service';

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

vi.mock('../services/payment.service', () => ({ getPayment: vi.fn() }));

function renderAt(query) {
  return render(
    <MemoryRouter initialEntries={[`/payment/result${query}`]}>
      <Routes>
        <Route path="/payment/result" element={<PaymentResult />} />
        <Route path="/pricing" element={<div>Pricing Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PaymentResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
  });

  it('shows success when API confirms SUCCESS even if query says success', async () => {
    paymentService.getPayment.mockResolvedValue({
      payment: {
        id: 'pay-1',
        status: 'SUCCESS',
        amountToman: 250000,
        planName: 'حرفه‌ای',
        refId: 'REF123',
        verifiedAt: '2025-01-01T00:00:00.000Z',
      },
    });
    renderAt('?status=success&paymentId=pay-1');
    await waitFor(() => expect(screen.getByText('پرداخت موفق')).toBeInTheDocument());
    expect(screen.getByText('REF123')).toBeInTheDocument();
    expect(screen.getByText('۲۵۰٬۰۰۰ تومان')).toBeInTheDocument();
  });

  it('shows failure when query says success but API says FAILED', async () => {
    paymentService.getPayment.mockResolvedValue({
      payment: {
        id: 'pay-1',
        status: 'FAILED',
        amountToman: 250000,
        failureReason: 'پرداخت لغو شد',
      },
    });
    renderAt('?status=success&paymentId=pay-1');
    await waitFor(() => expect(screen.getByText('پرداخت ناموفق')).toBeInTheDocument());
    expect(screen.getByText('پرداخت لغو شد')).toBeInTheDocument();
    expect(screen.queryByText('پرداخت موفق')).not.toBeInTheDocument();
  });

  it('does not trust query string success alone', async () => {
    paymentService.getPayment.mockResolvedValue({
      payment: { id: 'pay-1', status: 'PENDING', amountToman: 100000 },
    });
    renderAt('?status=success&paymentId=pay-1');
    await waitFor(() => expect(screen.getByText('پرداخت ناموفق')).toBeInTheDocument());
    expect(screen.queryByText('پرداخت موفق')).not.toBeInTheDocument();
  });

  it('shows error if paymentId missing', async () => {
    renderAt('?status=success');
    await waitFor(() => expect(screen.getByText('شناسه پرداخت یافت نشد.')).toBeInTheDocument());
  });

  it('redirects unauthenticated users to login', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderAt('?status=success&paymentId=pay-1');
    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
  });
});