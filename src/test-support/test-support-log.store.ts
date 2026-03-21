import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export type TestSupportEventLog = {
  id: string;
  type: string;
  message: string;
  bookingId?: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

@Injectable()
export class TestSupportLogStore {
  private readonly filePath = resolve(
    process.cwd(),
    '.tunetime-test-support',
    'event-log.json',
  );

  async list(): Promise<TestSupportEventLog[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is TestSupportEventLog => !!item)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch {
      return [];
    }
  }

  async append(
    event: Omit<TestSupportEventLog, 'id' | 'createdAt'>,
  ): Promise<TestSupportEventLog> {
    const nextEvent: TestSupportEventLog = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...event,
    };

    const current = await this.list();
    current.unshift(nextEvent);
    await this.write(current.slice(0, 100));
    return nextEvent;
  }

  async clear(): Promise<void> {
    try {
      await rm(this.filePath, { force: true });
    } catch {
      // Ignore cleanup failures in dev-only support storage.
    }
  }

  private async write(events: TestSupportEventLog[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(events, null, 2), 'utf8');
  }
}
