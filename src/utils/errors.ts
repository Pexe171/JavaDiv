export class AppError extends Error {
  public readonly code: string;
  public readonly context?: unknown;

  public constructor(code: string, message: string, context?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
  }
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}
