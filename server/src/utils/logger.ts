import fs from 'node:fs';
import path from 'node:path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

fs.mkdirSync(LOG_DIR, { recursive: true });
const fileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

/** Безопасная сериализация: Error не теряется в JSON.stringify. */
function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serialize);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serialize(nested);
    }
    return result;
  }
  return value;
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta === undefined ? {} : { meta: serialize(meta) }),
  };
  const line = JSON.stringify(entry);

  fileStream.write(`${line}\n`);

  // В тестах не засоряем stdout — файл всё равно пишется.
  if (process.env.NODE_ENV !== 'test') {
    if (level === 'ERROR') {
      console.error(line);
    } else if (level === 'WARN') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export const logger = {
  debug(message: string, meta?: unknown): void {
    write('DEBUG', message, meta);
  },
  info(message: string, meta?: unknown): void {
    write('INFO', message, meta);
  },
  warn(message: string, meta?: unknown): void {
    write('WARN', message, meta);
  },
  error(message: string, meta?: unknown): void {
    write('ERROR', message, meta);
  },
};

/** Поток для morgan: HTTP-логи идут в тот же файл. */
export const morganStream = {
  write(message: string): void {
    write('INFO', message.trim());
  },
};
