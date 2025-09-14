/**
 * Logger utility for development and production environments
 * Automatically strips debug logs in production builds
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment: boolean;
  private isClient: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isClient = typeof window !== 'undefined';
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only allow errors and warnings
    if (!this.isDevelopment) {
      return level === 'error' || level === 'warn';
    }

    // In development, allow all logs
    return true;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  // Canvas-specific logging methods
  canvas(message: string, ...args: any[]): void {
    this.debug(`🎨 ${message}`, ...args);
  }

  component(message: string, ...args: any[]): void {
    this.debug(`🧩 ${message}`, ...args);
  }

  wire(message: string, ...args: any[]): void {
    this.debug(`🔗 ${message}`, ...args);
  }

  auth(message: string, ...args: any[]): void {
    this.debug(`🔐 ${message}`, ...args);
  }

  api(message: string, ...args: any[]): void {
    this.debug(`🌐 ${message}`, ...args);
  }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience functions for direct use
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  canvas: logger.canvas.bind(logger),
  component: logger.component.bind(logger),
  wire: logger.wire.bind(logger),
  auth: logger.auth.bind(logger),
  api: logger.api.bind(logger),
};