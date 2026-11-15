import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterForm, { getPasswordStrength } from './RegisterForm';

const registerMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: registerMock }),
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
      <RegisterForm />
    </MemoryRouter>
  );
}

async function fillValidForm(overrides = {}) {
  fireEvent.change(screen.getByLabelText('نام و نام خانوادگی'), {
    target: { value: 'Ali Rezaei' },
  });
  fireEvent.change(screen.getByLabelText('ایمیل'), {
    target: { value: 'ali@example.com' },
  });
  fireEvent.change(screen.getByLabelText('رمز عبور'), {
    target: { value: overrides.password ?? 'Password1' },
  });
  fireEvent.change(screen.getByLabelText('تکرار رمز عبور'), {
    target: { value: overrides.confirmPassword ?? overrides.password ?? 'Password1' },
  });
}

describe('getPasswordStrength', () => {
  it('returns 0 for empty password', () => {
    expect(getPasswordStrength('')).toBe(0);
  });

  it('scales with password complexity', () => {
    expect(getPasswordStrength('abc')).toBe(0);
    expect(getPasswordStrength('abcdefgh')).toBe(1);
    expect(getPasswordStrength('Abcdefgh')).toBe(2);
    expect(getPasswordStrength('Abcdefg1')).toBe(3);
    expect(getPasswordStrength('Abcdefg1!')).toBe(4);
  });
});

describe('RegisterForm', () => {
  beforeEach(() => {
    registerMock.mockReset();
    navigateMock.mockReset();
  });

  it('shows validation messages for empty submit', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    expect(await screen.findByText('نام و نام خانوادگی الزامی است')).toBeInTheDocument();
    expect(await screen.findByText('ایمیل الزامی است')).toBeInTheDocument();
    expect(await screen.findByText('رمز عبور الزامی است')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('shows mismatch error when passwords differ', async () => {
    renderForm();
    await fillValidForm({ password: 'Password1', confirmPassword: 'Password2' });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    expect(
      await screen.findByText('تکرار رمز عبور با رمز عبور مطابقت ندارد')
    ).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('updates the strength meter live as the password changes', async () => {
    renderForm();

    expect(screen.getByTestId('strength-meter')).toBeInTheDocument();
    expect(screen.getByText(/قدرت رمز عبور: —/)).toBeInTheDocument();

    const passwordInput = screen.getByLabelText('رمز عبور');
    fireEvent.change(passwordInput, { target: { value: 'abcdefgh' } });
    expect(await screen.findByText(/قدرت رمز عبور: بسیار ضعیف/)).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { value: 'Abcdefg1' } });
    expect(await screen.findByText(/قدرت رمز عبور: متوسط/)).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { value: 'Abcdefg1!' } });
    expect(await screen.findByText(/قدرت رمز عبور: قوی/)).toBeInTheDocument();
  });

  it('does not submit when password strength is too low', async () => {
    renderForm();
    await fillValidForm({ password: 'abcdefgh', confirmPassword: 'abcdefgh' });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    await new Promise((r) => setTimeout(r, 50));
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('submits valid data and redirects to /login with success toast', async () => {
    registerMock.mockResolvedValue({ id: 'u1', email: 'ali@example.com' });
    renderForm();
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    expect(registerMock).toHaveBeenCalledWith({
      fullName: 'Ali Rezaei',
      email: 'ali@example.com',
      password: 'Password1',
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', {
        replace: true,
        state: {
          toast: {
            type: 'success',
            message: 'ثبت‌نام با موفقیت انجام شد. حالا می‌توانید وارد شوید.',
          },
        },
      });
    });
  });

  it('includes optional phone when provided', async () => {
    registerMock.mockResolvedValue({ id: 'u1' });
    renderForm();
    await fillValidForm();
    fireEvent.change(screen.getByLabelText('شماره موبایل (اختیاری)'), {
      target: { value: '09121234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        fullName: 'Ali Rezaei',
        email: 'ali@example.com',
        password: 'Password1',
        phone: '09121234567',
      });
    });
  });

  it('shows server error when registration fails', async () => {
    registerMock.mockRejectedValue({
      response: {
        data: {
          success: false,
          error: { code: 'CONFLICT', message: 'این ایمیل قبلاً ثبت شده است' },
        },
      },
    });
    renderForm();
    await fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت‌نام' }));

    expect(
      await screen.findByText('این ایمیل قبلاً ثبت شده است')
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});