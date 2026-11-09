import type { Notifier } from './notifier';

/** Реализация для разработки и тестов: всегда успешна. */
export class ConsoleNotifier implements Notifier {
  async send(message: string): Promise<boolean> {
    console.log(`[ConsoleNotifier] ${message}`);
    return true;
  }
}
