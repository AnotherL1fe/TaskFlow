import { env } from '../config/env';
import type { Notifier, NotifierKind } from '../integrations/notifier';
import { ConsoleNotifier } from '../integrations/console.notifier';
import { TelegramNotifier } from '../integrations/telegram.notifier';
import type { Task } from '../generated/prisma/client';
import { logger } from '../utils/logger';

const instances = new Map<NotifierKind, Notifier>();

/**
 * Фабрика (шаблон Factory Method): скрывает выбор реализации Notifier.
 * Тип читается из окружения в момент вызова — это позволяет подменять
 * реализацию в тестах без перезапуска модуля.
 */
export const NotifierFactory = {
  get(kind?: NotifierKind): Notifier {
    const resolved = kind ?? currentKind();
    const existing = instances.get(resolved);
    if (existing) {
      return existing;
    }

    const notifier: Notifier =
      resolved === 'telegram' ? new TelegramNotifier() : new ConsoleNotifier();
    instances.set(resolved, notifier);
    return notifier;
  },

  /** Сброс кэша — используется в тестах. */
  reset(): void {
    instances.clear();
  },
};

function currentKind(): NotifierKind {
  const raw = process.env.NOTIFIER ?? env.NOTIFIER;
  return raw === 'telegram' ? 'telegram' : 'console';
}

export function buildTaskCreatedMessage(task: Task): string {
  const lines = [
    `[TaskFlow] Новая задача #${task.id}: «${task.title}»`,
    `Проект: #${task.projectId} | Приоритет: ${task.priority}`,
  ];
  if (task.deadline) {
    lines.push(`Дедлайн: ${task.deadline.toISOString()}`);
  }
  if (task.assigneeId !== null) {
    lines.push(`Исполнитель: #${task.assigneeId}`);
  }
  return lines.join('\n');
}

/**
 * Observer-хук: вызывается после создания задачи.
 * Любая ошибка интеграции логируется и НЕ откатывает создание задачи.
 */
export async function afterCreateHook(
  task: Task,
  notifier: Notifier = NotifierFactory.get(),
): Promise<boolean> {
  const message = buildTaskCreatedMessage(task);

  try {
    const delivered = await notifier.send(message);
    if (!delivered) {
      logger.error('Task notification was not delivered', {
        taskId: task.id,
        notifier: notifier.constructor.name,
      });
      return false;
    }

    logger.info('Task notification delivered', {
      taskId: task.id,
      notifier: notifier.constructor.name,
    });
    return true;
  } catch (error) {
    logger.error('Task notification failed with exception', { taskId: task.id, error });
    return false;
  }
}
