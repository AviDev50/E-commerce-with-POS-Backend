export function fail(message: string, statusCode = 400): never {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  throw err;
}