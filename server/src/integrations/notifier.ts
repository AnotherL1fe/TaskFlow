/**
 * Контракт интеграции уведомлений.
 * Реализации: TelegramNotifier (prod), ConsoleNotifier (dev/tests).
 */
export interface Notifier {
  send(message: string): Promise<boolean>;
}

export type NotifierKind = 'telegram' | 'console';
