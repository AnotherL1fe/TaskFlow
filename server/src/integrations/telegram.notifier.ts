import TelegramBot from 'node-telegram-bot-api';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { Notifier } from './notifier';

/**
 * Telegram-реализация Notifier.
 * Бот создаётся лениво: приложение работает и без токена,
 * а ошибка отправки не должна ломать бизнес-операцию.
 */
export class TelegramNotifier implements Notifier {
  private readonly token: string | undefined;
  private readonly chatId: string | undefined;
  private bot: TelegramBot | null = null;

  constructor(
    token: string | undefined = env.TELEGRAM_BOT_TOKEN,
    chatId: string | undefined = env.TELEGRAM_CHAT_ID,
  ) {
    this.token = token;
    this.chatId = chatId;
  }

  async send(message: string): Promise<boolean> {
    if (!this.token || !this.chatId) {
      logger.warn('Telegram is not configured: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID are empty');
      return false;
    }

    try {
      this.bot ??= new TelegramBot(this.token, { polling: false });
      await this.bot.sendMessage(this.chatId, message);
      return true;
    } catch (error) {
      logger.error('Telegram sendMessage failed', { error });
      return false;
    }
  }
}
