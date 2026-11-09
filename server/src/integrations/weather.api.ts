import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/** Нормализованные данные о погоде, не зависящие от формата внешнего API. */
export interface WeatherData {
  city: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  windSpeed: number;
  fetchedAt: string;
}

interface CacheEntry {
  data: WeatherData;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 минут
const CACHE_MAX_ENTRIES = 100;
const REQUEST_TIMEOUT_MS = 5000;

const cache = new Map<string, CacheEntry>();

/** Runtime-валидация ответа OpenWeatherMap: не доверяем внешнему API. */
const OpenWeatherResponseSchema = z.object({
  name: z.string().min(1),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number(),
  }),
  weather: z
    .array(
      z.object({
        description: z.string(),
      }),
    )
    .min(1),
  wind: z.object({
    speed: z.number(),
  }),
});

type OpenWeatherResponse = z.infer<typeof OpenWeatherResponseSchema>;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function toWeatherData(response: OpenWeatherResponse): WeatherData {
  const condition = response.weather[0];
  return {
    city: response.name,
    temperature: round(response.main.temp),
    feelsLike: round(response.main.feels_like),
    humidity: response.main.humidity,
    description: condition ? condition.description : 'n/a',
    windSpeed: round(response.wind.speed),
    fetchedAt: new Date().toISOString(),
  };
}

function evictOldestIfNeeded(): void {
  if (cache.size < CACHE_MAX_ENTRIES) {
    return;
  }
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) {
    cache.delete(oldestKey);
  }
}

function logRequestError(error: unknown, city: string): void {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      logger.error('Weather API timeout', { city, timeoutMs: REQUEST_TIMEOUT_MS });
      return;
    }
    if (status === 401 || status === 403) {
      logger.error('Weather API rejected the credentials', { city, status });
      return;
    }
    logger.error('Weather API request failed', { city, status, code: error.code });
    return;
  }

  logger.error('Weather API unexpected error', { city, error });
}

/**
 * Получить погоду по городу.
 * Контракт: никогда не бросает наружу — при любой проблеме возвращает null.
 * Кэш: Map с TTL 10 минут, ключ нормализуется (trim + lower case).
 */
export async function getWeather(city: string): Promise<WeatherData | null> {
  const normalizedCity = city.trim().toLowerCase();

  if (normalizedCity.length === 0) {
    logger.warn('getWeather called with empty city');
    return null;
  }

  const cached = cache.get(normalizedCity);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    cache.delete(normalizedCity);
  }

  const apiKey = env.WEATHER_API_KEY;
  if (!apiKey) {
    logger.warn('WEATHER_API_KEY is not configured, weather request skipped');
    return null;
  }

  try {
    const response = await axios.get<unknown>(env.WEATHER_API_URL, {
      params: {
        q: city.trim(),
        appid: apiKey,
        units: 'metric',
        lang: 'ru',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const parsed = OpenWeatherResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      logger.error('Weather API returned an unexpected payload', {
        city,
        issues: parsed.error.issues,
      });
      return null;
    }

    const data = toWeatherData(parsed.data);
    evictOldestIfNeeded();
    cache.set(normalizedCity, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data;
  } catch (error) {
    logRequestError(error, city);
    return null;
  }
}

/** Сброс кэша — для тестов и ручной инвалидации. */
export function clearWeatherCache(): void {
  cache.clear();
}
