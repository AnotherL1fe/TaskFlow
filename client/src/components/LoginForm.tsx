import { useState, type FormEvent } from 'react';
import { login, register } from '../api/authApi';
import { errorMessage, storeToken } from '../api/http';
import type { AuthResponse } from '../types/task';

interface LoginFormProps {
  onAuthenticated: (auth: AuthResponse) => void;
}

type Mode = 'login' | 'register';

export function LoginForm({ onAuthenticated }: LoginFormProps): JSX.Element {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const auth = isRegister
        ? await register({ username, email, password })
        : await login({ email, password });

      storeToken(auth.token);
      onAuthenticated(auth);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={(event) => void handleSubmit(event)}>
      <h2>{isRegister ? 'Регистрация' : 'Вход в TaskFlow'}</h2>
      <p className="muted">
        {isRegister
          ? 'Создайте аккаунт, чтобы управлять задачами.'
          : 'Введите email и пароль. Тестовый пользователь: ivan@example.com / secret123.'}
      </p>

      {isRegister && (
        <label className="field">
          <span>Имя пользователя</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={50}
            required
            autoComplete="username"
          />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
          title="Введите email вида name@example.com"
          required
          autoComplete="email"
        />
      </label>

      <label className="field">
        <span>Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={isRegister ? 8 : 1}
          maxLength={72}
          required
          autoComplete={isRegister ? 'new-password' : 'current-password'}
        />
      </label>

      {error && <p className="alert">{error}</p>}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Подождите…' : isRegister ? 'Зарегистрироваться' : 'Войти'}
      </button>

      <button
        type="button"
        className="link"
        onClick={() => {
          setMode(isRegister ? 'login' : 'register');
          setError(null);
        }}
      >
        {isRegister ? 'У меня уже есть аккаунт' : 'Создать аккаунт'}
      </button>
    </form>
  );
}
