type ErrorDetails = {
  code?: string;
  message: string;
  status?: number;
  details?: string;
  hint?: string;
};

function isErrorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorDetails(error: unknown): ErrorDetails {
  if (!isErrorRecord(error)) {
    return { message: 'An unknown backend error occurred.' };
  }

  const statusValue = error.status ?? error.statusCode;
  const parsedStatus =
    typeof statusValue === 'number'
      ? statusValue
      : typeof statusValue === 'string'
        ? Number.parseInt(statusValue, 10)
        : undefined;

  return {
    ...(typeof error.details === 'string' ? { details: error.details } : {}),
    ...(typeof error.hint === 'string' ? { hint: error.hint } : {}),
    message:
      typeof error.message === 'string'
        ? error.message
        : 'An unknown backend error occurred.',
    ...(typeof error.code === 'string'
      ? { code: error.code }
      : {}),
    ...(parsedStatus !== undefined && !Number.isNaN(parsedStatus)
      ? { status: parsedStatus }
      : {}),
  };
}

function isRetryable(error: unknown, details: ErrorDetails) {
  if (error instanceof TypeError) {
    return true;
  }

  return (
    details.status === 408 ||
    details.status === 429 ||
    (details.status !== undefined && details.status >= 500) ||
    details.code?.startsWith('08') === true
  );
}

export class SupabaseServiceError extends Error {
  readonly code?: string;
  readonly operation: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly details?: string;
  readonly hint?: string;

  constructor(
    operation: string,
    message: string,
    options: {
      cause?: unknown;
      code?: string;
      retryable?: boolean;
      status?: number;
      details?: string;
      hint?: string;
    } = {}
  ) {
    super(`${operation}: ${message}`, { cause: options.cause });
    this.name = 'SupabaseServiceError';
    this.operation = operation;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.hint = options.hint;
    this.retryable = options.retryable ?? false;
  }
}

export function createSupabaseServiceError(
  operation: string,
  error: unknown
) {
  if (error instanceof SupabaseServiceError) {
    return error;
  }

  const details = readErrorDetails(error);
  return new SupabaseServiceError(operation, details.message, {
    cause: error,
    code: details.code,
    retryable: isRetryable(error, details),
    status: details.status,
    details: details.details,
    hint: details.hint,
  });
}

export function throwSupabaseServiceError(
  operation: string,
  error: unknown
): never {
  throw createSupabaseServiceError(operation, error);
}
