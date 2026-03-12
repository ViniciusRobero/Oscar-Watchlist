import { describe, it, expect } from 'vitest';
import { safeUrl } from '../../utils/safeUrl.js';

describe('safeUrl()', () => {
  it('accepts https URLs', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
  });

  it('accepts http URLs', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('rejects javascript: protocol', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects data: protocol', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects malformed URLs', () => {
    expect(safeUrl('not-a-url')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(safeUrl(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(safeUrl(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeUrl('')).toBeNull();
  });

  it('preserves query strings and fragments', () => {
    const url = 'https://imdb.com/title/tt123?ref=nm&mode=desktop#cast';
    expect(safeUrl(url)).toBe(url);
  });
});
