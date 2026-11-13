import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlanCards from './PlanCards';
import * as planService from '../../services/plan.service';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../services/plan.service', () => ({
  getPlans: vi.fn(),
}));

const plans = [
  { id: 'p1', name: 'پایه', priceToman: 100000, durationDays: 30, features: ['الف', 'ب'], sortOrder: 1 },
  { id: 'p2', name: 'حرفه‌ای', priceToman: 250000, durationDays: 90, features: ['الف', 'ب', 'ج'], sortOrder: 2 },
  { id: 'p3', name: 'ویژه', priceToman: 500000, durationDays: 365, features: ['الف', 'ب', 'ج', 'د'], sortOrder: 3 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <PlanCards />
    </MemoryRouter>
  );
}

describe('PlanCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton while loading', () => {
    planService.getPlans.mockReturnValue(new Promise(() => {}));
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    const { container } = renderPage();
    expect(container.querySelectorAll('.plan-card').length).toBeGreaterThan(0);
  });

  it('renders plans and highlights middle one', async () => {
    planService.getPlans.mockResolvedValue(plans);
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText('پایه')).toBeInTheDocument());
    expect(screen.getByText('حرفه‌ای')).toBeInTheDocument();
    expect(screen.getByText('ویژه')).toBeInTheDocument();
    expect(screen.getByText('محبوب‌ترین')).toBeInTheDocument();
    const popularCards = container.querySelectorAll('.plan-card--popular');
    expect(popularCards.length).toBe(1);
    expect(popularCards[0].textContent).toContain('حرفه‌ای');
  });

  it('shows error state on failure', async () => {
    planService.getPlans.mockRejectedValue({ response: { data: { error: { message: 'boom' } } } });
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderPage();
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });

  it('redirects unauthenticated users to login on buy', async () => {
    planService.getPlans.mockResolvedValue(plans);
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderPage();
    await waitFor(() => expect(screen.getByText('پایه')).toBeInTheDocument());
    const buyButtons = screen.getAllByText('خرید');
    fireEvent.click(buyButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/checkout/p1' } });
  });

  it('navigates authenticated users to checkout', async () => {
    planService.getPlans.mockResolvedValue(plans);
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderPage();
    await waitFor(() => expect(screen.getByText('پایه')).toBeInTheDocument());
    const buyButtons = screen.getAllByText('خرید');
    fireEvent.click(buyButtons[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/checkout/p2');
  });
});