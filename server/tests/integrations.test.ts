import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import { env } from '../src/config/env';
import type { Task } from '../src/generated/prisma/client';
import type { Notifier } from '../src/integrations/notifier';
import { TelegramNotifier } from '../src/integrations/telegram.notifier';
import { clearWeatherCache, getWeather } from '../src/integrations/weather.api';
import { afterCreateHook } from '../src/services/notification.service';
import { logger } from '../src/utils/logger';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isAxiosError: (error: unknown): boolean =>
      Boolean((error as { isAxiosError?: boolean } | null)?.isAxiosError),
  },
}));

jest.mock('node-telegram-bot-api', () => jest.fn());

const getMock = axios.get as unknown as jest.Mock;
const telegramBotMock = TelegramBot as unknown as jest.Mock;

const fixture = {
  name: 'Moscow',
  main: { temp: 4.26, feels_like: 1.04, humidity: 81 },
  weather: [{ description: 'небольшой дождь' }],
  wind: { speed: 3.6 },
};

beforeAll(() => {
  (env as { WEATHER_API_KEY?: string }).WEATHER_API_KEY = 'test-key';
});

beforeEach(() => {
  clearWeatherCache();
  getMock.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Weather integration (axios mocked)', () => {
  it('success: ответ нормализуется в WeatherData', async () => {
    getMock.mockResolvedValue({ data: fixture });

    const weather = await getWeather('Moscow');

    expect(weather).toMatchObject({
      city: 'Moscow',
      temperature: 4.3,
      feelsLike: 1,
      humidity: 81,
      description: 'небольшой дождь',
      windSpeed: 3.6,
    });
    expect(typeof weather?.fetchedAt).toBe('string');
    expect(getMock).toHaveBeenCalledWith(
      env.WEATHER_API_URL,
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('cache: повторный запрос не идёт в сеть', async () => {
    getMock.mockResolvedValue({ data: fixture });

    await getWeather('Moscow');
    const cached = await getWeather('  MOSCOW  ');

    expect(cached?.city).toBe('Moscow');
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('cache TTL: через 10 минут выполняется новый запрос', async () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    getMock.mockResolvedValue({ data: fixture });
    await getWeather('Tver');

    now += 10 * 60 * 1000 + 1;
    await getWeather('Tver');

    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it('timeout: AxiosError ECONNABORTED -> null + ERROR', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    getMock.mockRejectedValue(
      Object.assign(new Error('timeout of 5000ms exceeded'), {
        isAxiosError: true,
        code: 'ECONNABORTED',
      }),
    );

    const weather = await getWeather('Omsk');

    expect(weather).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('Weather API timeout', {
      city: 'Omsk',
      timeoutMs: 5000,
    });
  });

  it('401: AxiosError со статусом 401 -> null + ERROR', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    getMock.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        code: 'ERR_BAD_REQUEST',
        response: { status: 401 },
      }),
    );

    const weather = await getWeather('Kazan');

    expect(weather).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('Weather API rejected the credentials', {
      city: 'Kazan',
      status: 401,
    });
  });

  it('невалидный payload -> null + ERROR', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    getMock.mockResolvedValue({ data: { name: 'Nowhere' } });

    const weather = await getWeather('Nowhere');

    expect(weather).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'Weather API returned an unexpected payload',
      expect.objectContaining({ city: 'Nowhere' }),
    );
  });
});

describe('Telegram integration (node-telegram-bot-api mocked)', () => {
  it('send: успешная отправка -> true', async () => {
    const sendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
    telegramBotMock.mockImplementation(() => ({ sendMessage }));

    const notifier = new TelegramNotifier('token', 'chat-id');

    await expect(notifier.send('hello')).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledWith('chat-id', 'hello');
  });

  it('send: ошибка Telegram -> false + ERROR', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const sendMessage = jest.fn().mockRejectedValue(new Error('network down'));
    telegramBotMock.mockImplementation(() => ({ sendMessage }));

    const notifier = new TelegramNotifier('token', 'chat-id');

    await expect(notifier.send('hello')).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Telegram sendMessage failed',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('send без токена -> false + WARN', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');
    const notifier = new TelegramNotifier(undefined, undefined);

    await expect(notifier.send('hello')).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'Telegram is not configured: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are empty',
    );
  });
});

describe('Observer hook', () => {
  const task = {
    id: 42,
    title: 'Hook test',
    projectId: 1,
    priority: 1,
    deadline: null,
    assigneeId: null,
  } as unknown as Task;

  it('исключение notifier не пробрасывается наружу', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const throwing: Notifier = {
      send: jest.fn().mockRejectedValue(new Error('boom')),
    };

    await expect(afterCreateHook(task, throwing)).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      'Task notification failed with exception',
      expect.objectContaining({ taskId: 42 }),
    );
  });

  it('успешная доставка -> true', async () => {
    const ok: Notifier = { send: jest.fn().mockResolvedValue(true) };

    await expect(afterCreateHook(task, ok)).resolves.toBe(true);
  });
});
