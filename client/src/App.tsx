import { useCallback, useState } from 'react';
import { getStoredToken, storeToken } from './api/http';
import { LoginForm } from './components/LoginForm';
import { TasksPage } from './pages/TasksPage';
import type { AuthResponse } from './types/task';

export function App(): JSX.Element {
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const handleAuthenticated = useCallback((auth: AuthResponse): void => {
    storeToken(auth.token);
    setToken(auth.token);
  }, []);

  const handleLogout = useCallback((): void => {
    storeToken(null);
    setToken(null);
  }, []);

  if (token === null) {
    return (
      <div className="page auth-page">
        <header className="topbar">
          <div>
            <h1>TaskFlow</h1>
            <p className="muted">Управление задачами и проектами</p>
          </div>
        </header>

        <main className="auth-layout">
          <LoginForm onAuthenticated={handleAuthenticated} />
        </main>
      </div>
    );
  }

  return <TasksPage onLogout={handleLogout} />;
}
