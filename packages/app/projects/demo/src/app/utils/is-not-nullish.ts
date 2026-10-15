// type check to allow narrowing observable return types using filter
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value != null;
}
