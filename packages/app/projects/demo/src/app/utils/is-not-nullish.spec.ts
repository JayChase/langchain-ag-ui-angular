import { isNotNullish } from './is-not-nullish';

describe('isNotNullish', () => {
  it('should return false for null', () => {
    expect(isNotNullish(null)).toBe(false);
  });

  it('should return true for non-null values', () => {
    expect(isNotNullish('value')).toBe(true);
  });
});
