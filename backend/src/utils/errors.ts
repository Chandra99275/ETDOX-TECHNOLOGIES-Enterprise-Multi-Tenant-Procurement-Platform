export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: { path: string; code: string }[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
