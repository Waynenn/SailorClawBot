import type { Logger } from "@sailorclawbot/core";

/** Minimal structured console logger for the worker process. */
export class ConsoleLogger implements Logger {
	public info(message: string, context?: Record<string, unknown>): void {
		console.log(`[info] ${message}`, context ?? "");
	}

	public warn(message: string, context?: Record<string, unknown>): void {
		console.warn(`[warn] ${message}`, context ?? "");
	}

	public error(message: string, context?: Record<string, unknown>): void {
		console.error(`[error] ${message}`, context ?? "");
	}
}
