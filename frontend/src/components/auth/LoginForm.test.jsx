import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginForm from './LoginForm';

const loginMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
  });

  it('shows validation messages for empty fields on submit', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    expect(await screen.findByText('ایمیل الزامی است')).toBeInTheDocument();
    expect(await screen.findByText('رمز عبور الزامی است')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('shows validation message for invalid email', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('ایمیل'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'Password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    expect(await screen.findByText('ایمیل معتبر نیست')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login with entered credentials on valid submit', async () => {
    loginMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    renderForm();

    fireEvent.change(screen.getByLabelText('ایمیل'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'Password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1);
    });
    expect(loginMock).toHaveBeenCalledWith('user@example.com', 'Password1');
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('navigates admins to /admin after successful login', async () => {
    loginMock.mockResolvedValue({ id: 'a1', role: 'ADMIN' });
    renderForm();

    fireEvent.change(screen.getByLabelText('ایمیل'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'Password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('shows server error message from API', async () => {
    loginMock.mockRejectedValue({
      response: {
        data: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'ایمیل یا رمز عبور نادرست است' },
        },
      },
    });
    renderForm();

    fireEvent.change(screen.getByLabelText('ایمیل'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'Password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    expect(
      await screen.findByText('ایمیل یا رمز عبور نادرست است')
    ).toBeInTheDocument();
  });

  it('shows a specific message when account is locked', async () => {
    loginMock.mockRejectedValue({
      response: {
        data: {
          success: false,
          error: { code: 'ACCOUNT_LOCKED', message: 'locked' },
        },
      },
    });
    renderForm();

    fireEvent.change(screen.getByLabelText('ایمیل'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'Password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    expect(
      await screen.findByText(/موقتاً قفل شده است/)
    ).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    renderForm();
    const passwordInput = screen.getByLabelText('رمز عبور');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'نمایش رمز عبور' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'پنهان کردن رمز عبور' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});