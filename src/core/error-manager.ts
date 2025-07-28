/**
 * Comprehensive error handling system for the IDE
 */

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorCategory {
  SYSTEM = "system",
  VALIDATION = "validation",
  NETWORK = "network",
  SIMULATION = "simulation",
  FILE_IO = "file-io",
  COMPONENT = "component",
  CIRCUIT = "circuit",
  USER_INPUT = "user-input",
  PERFORMANCE = "performance",
}

export interface IDEError {
  id: string;
  code: string;
  message: string;
  details?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: Date;
  source?: string;
  stackTrace?: string;
  context?: Record<string, any>;
  recoverable: boolean;
  recoveryActions?: ErrorRecoveryAction[];
}

export interface ErrorRecoveryAction {
  id: string;
  label: string;
  description: string;
  action: () => Promise<void> | void;
  primary?: boolean;
}

export interface ErrorHandler {
  canHandle(error: IDEError): boolean;
  handle(error: IDEError): Promise<void> | void;
  priority: number;
}

class ErrorManager {
  private errors: Map<string, IDEError> = new Map();
  private handlers: ErrorHandler[] = [];
  private listeners: ((error: IDEError) => void)[] = [];
  private errorCount: Record<ErrorSeverity, number> = {
    [ErrorSeverity.LOW]: 0,
    [ErrorSeverity.MEDIUM]: 0,
    [ErrorSeverity.HIGH]: 0,
    [ErrorSeverity.CRITICAL]: 0,
  };

  /**
   * Register an error handler
   */
  registerHandler(handler: ErrorHandler) {
    this.handlers.push(handler);
    this.handlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add error listener
   */
  addListener(listener: (error: IDEError) => void) {
    this.listeners.push(listener);
  }

  /**
   * Remove error listener
   */
  removeListener(listener: (error: IDEError) => void) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Report an error
   */
  async reportError(
    error: Partial<IDEError> & { message: string; category: ErrorCategory }
  ): Promise<string> {
    const ideError: IDEError = {
      id: this.generateErrorId(),
      code: error.code || this.generateErrorCode(error.category),
      message: error.message,
      details: error.details,
      severity: error.severity || ErrorSeverity.MEDIUM,
      category: error.category,
      timestamp: new Date(),
      source: error.source,
      stackTrace: error.stackTrace || new Error().stack,
      context: error.context,
      recoverable: error.recoverable ?? true,
      recoveryActions: error.recoveryActions || [],
    };

    // Store error
    this.errors.set(ideError.id, ideError);
    this.errorCount[ideError.severity]++;

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(ideError);
      } catch (e) {
        console.error("Error in error listener:", e);
      }
    });

    // Handle error
    await this.handleError(ideError);

    return ideError.id;
  }

  /**
   * Get error by ID
   */
  getError(id: string): IDEError | undefined {
    return this.errors.get(id);
  }

  /**
   * Get all errors
   */
  getAllErrors(): IDEError[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): IDEError[] {
    return this.getAllErrors().filter((error) => error.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): IDEError[] {
    return this.getAllErrors().filter((error) => error.severity === severity);
  }

  /**
   * Clear error
   */
  clearError(id: string): boolean {
    const error = this.errors.get(id);
    if (error) {
      this.errors.delete(id);
      this.errorCount[error.severity]--;
      return true;
    }
    return false;
  }

  /**
   * Clear all errors
   */
  clearAllErrors() {
    this.errors.clear();
    Object.keys(this.errorCount).forEach((key) => {
      this.errorCount[key as ErrorSeverity] = 0;
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      total: this.errors.size,
      bySeverity: { ...this.errorCount },
      byCategory: this.getErrorCountByCategory(),
    };
  }

  /**
   * Execute recovery action
   */
  async executeRecoveryAction(
    errorId: string,
    actionId: string
  ): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error) return false;

    const action = error.recoveryActions?.find((a) => a.id === actionId);
    if (!action) return false;

    try {
      await action.action();
      return true;
    } catch (e) {
      console.error("Error executing recovery action:", e);
      return false;
    }
  }

  private async handleError(error: IDEError) {
    // Find appropriate handler
    const handler = this.handlers.find((h) => h.canHandle(error));

    if (handler) {
      try {
        await handler.handle(error);
      } catch (e) {
        console.error("Error in error handler:", e);
      }
    } else {
      // Default handling
      this.defaultErrorHandler(error);
    }
  }

  private defaultErrorHandler(error: IDEError) {
    // Log error
    console.error(
      `[${error.severity.toUpperCase()}] ${error.category}: ${error.message}`,
      {
        code: error.code,
        details: error.details,
        context: error.context,
        stackTrace: error.stackTrace,
      }
    );

    // Critical errors should be handled immediately
    if (error.severity === ErrorSeverity.CRITICAL) {
      // Could trigger emergency save, reset state, etc.
      console.error("CRITICAL ERROR - Consider emergency procedures");
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorCode(category: ErrorCategory): string {
    const prefix = category.toUpperCase().replace("-", "_");
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}_${timestamp}`;
  }

  private getErrorCountByCategory(): Record<ErrorCategory, number> {
    const counts = {} as Record<ErrorCategory, number>;
    Object.values(ErrorCategory).forEach((category) => {
      counts[category] = 0;
    });

    this.errors.forEach((error) => {
      counts[error.category]++;
    });

    return counts;
  }
}

// Create global error manager
export const errorManager = new ErrorManager();

// Common error factories
export const ErrorFactories = {
  validationError: (
    message: string,
    details?: string,
    context?: Record<string, any>
  ): Partial<IDEError> => ({
    message,
    details,
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.MEDIUM,
    context,
    recoverable: true,
  }),

  networkError: (message: string, details?: string): Partial<IDEError> => ({
    message,
    details,
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    recoveryActions: [
      {
        id: "retry",
        label: "Retry",
        description: "Retry the network operation",
        action: () => console.log("Retrying network operation"),
        primary: true,
      },
    ],
  }),

  simulationError: (
    message: string,
    details?: string,
    context?: Record<string, any>
  ): Partial<IDEError> => ({
    message,
    details,
    category: ErrorCategory.SIMULATION,
    severity: ErrorSeverity.MEDIUM,
    context,
    recoverable: true,
  }),

  fileIOError: (message: string, details?: string): Partial<IDEError> => ({
    message,
    details,
    category: ErrorCategory.FILE_IO,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
  }),

  systemError: (message: string, details?: string): Partial<IDEError> => ({
    message,
    details,
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
  }),
};

// Default error handlers
export class ConsoleErrorHandler implements ErrorHandler {
  priority = 0;

  canHandle(error: IDEError): boolean {
    return true; // Can handle any error as fallback
  }

  handle(error: IDEError): void {
    const level = this.getSeverityLogLevel(error.severity);
    console[level](`[${error.code}] ${error.message}`, {
      details: error.details,
      context: error.context,
    });
  }

  private getSeverityLogLevel(
    severity: ErrorSeverity
  ): "log" | "warn" | "error" {
    switch (severity) {
      case ErrorSeverity.LOW:
        return "log";
      case ErrorSeverity.MEDIUM:
        return "warn";
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return "error";
    }
  }
}

// Initialize error handling
export function initializeErrorHandling() {
  // Register default handlers
  errorManager.registerHandler(new ConsoleErrorHandler());

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    errorManager.reportError({
      message: "Unhandled promise rejection",
      details: event.reason?.toString(),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      source: "unhandledrejection",
    });
  });

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    errorManager.reportError({
      message: event.message || "Uncaught error",
      details: `${event.filename}:${event.lineno}:${event.colno}`,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      source: "uncaught-error",
      stackTrace: event.error?.stack,
    });
  });
}
