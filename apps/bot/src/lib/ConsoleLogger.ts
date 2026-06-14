import type { Logger } from '@sailorclawbot/core';

export class ConsoleLogger implements Logger {
  public info(message: string, context?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'INFO', message, ...context, ts: new Date().toISOString() }));
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 'WARN', message, ...context, ts: new Date().toISOString() }));
  }

  public error(message: string, context?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 'ERROR', message, ...context, ts: new Date().toISOString() }));
  }
}
