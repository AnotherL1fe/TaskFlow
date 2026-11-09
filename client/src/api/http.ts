const TOKEN_KEY = 'taskflow_token';

export class ApiError extends Error {
  public readonly status: number;
  public readonly details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  password: 'Пароль',
  username: 'Имя пользователя',
  title: 'Название',
  description: 'Описание',
  priority: 'Приоритет',
  deadline: 'Дедлайн',
  projectId: 'Проект',
  assigneeId: 'Исполнитель',
  status: 'Статус',
};

/** Достаёт из ответа 400 список нарушений и превращает их в читаемый текст. */
function validationMessage(details: unknown): string | null {
  if (!isRecord(details) || !Array.isArray(details.issues)) {
    return null;
  }

  const parts: string[] = [];
  for (const issue of details.issues) {
    if (!isRecord(issue) || typeof issue.message !== 'string') {
      continue;
    }
    const path = typeof issue.path === 'string' ? issue.path : '';
    const label = FIELD_LABELS[path] ?? path;
    parts.push(label ? `${label}: ${issue.message}` : issue.message);
  }

  return parts.length > 0 ? parts.join('; ') : null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return validationMessage(error.details) ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка';
}

/**
 * Общий обработчик запросов: заголовки, токен, разбор ошибки,
 * единый формат { error: string } с сервера.
 */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : `Ошибка запроса (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  // Граница HTTP: точная форма ответа зафиксирована типами API.
  return payload as T;
}
