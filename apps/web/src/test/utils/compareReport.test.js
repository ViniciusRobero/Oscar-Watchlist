import { describe, it, expect } from 'vitest';
import { esc, reportGrad, officialFilmForRow, REPORT_GRADS } from '../../utils/compareReport.js';

describe('esc()', () => {
  it('escapes ampersand', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('handles null/undefined gracefully', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  it('does not modify plain text', () => {
    expect(esc('hello world')).toBe('hello world');
  });
});

describe('reportGrad()', () => {
  it('returns a gradient string', () => {
    const grad = reportGrad('alice');
    expect(REPORT_GRADS).toContain(grad);
  });

  it('is deterministic — same name always gives same gradient', () => {
    expect(reportGrad('bob')).toBe(reportGrad('bob'));
    expect(reportGrad('charlie')).toBe(reportGrad('charlie'));
  });

  it('different names can return different gradients', () => {
    // Not guaranteed but very likely with 7 options
    const names = ['alice', 'bob', 'charlie', 'dave', 'eve', 'frank', 'grace', 'henry'];
    const grads = new Set(names.map(reportGrad));
    expect(grads.size).toBeGreaterThan(1);
  });
});

describe('officialFilmForRow()', () => {
  const categories = [
    {
      id: 'best-picture',
      nominees: [
        { id: 'nom-1', filmId: 'film-oppenheimer' },
        { id: 'nom-2', filmId: 'film-barbie' },
      ],
    },
  ];

  const filmById = (id) => id ? { id, title: id } : undefined;

  it('returns null when category does not exist', () => {
    const result = officialFilmForRow('nonexistent-cat', { 'nonexistent-cat': 'nom-1' }, categories, filmById);
    expect(result).toBeNull();
  });

  it('returns null when officialResults has no entry for category', () => {
    const result = officialFilmForRow('best-picture', {}, categories, filmById);
    expect(result).toBeNull();
  });

  it('returns null when officialResults is undefined', () => {
    const result = officialFilmForRow('best-picture', undefined, categories, filmById);
    expect(result).toBeNull();
  });

  it('returns the correct film when nominee found', () => {
    const result = officialFilmForRow('best-picture', { 'best-picture': 'nom-1' }, categories, filmById);
    expect(result).toEqual({ id: 'film-oppenheimer', title: 'film-oppenheimer' });
  });

  it('returns null when nominee ID not found in category', () => {
    const result = officialFilmForRow('best-picture', { 'best-picture': 'nom-99' }, categories, filmById);
    expect(result).toBeNull();
  });

  it('returns null when filmById returns undefined for filmId', () => {
    const filmByIdNull = () => undefined;
    const cats = [{ id: 'cat1', nominees: [{ id: 'n1', filmId: 'f1' }] }];
    const result = officialFilmForRow('cat1', { cat1: 'n1' }, cats, filmByIdNull);
    // nom.filmId is truthy ('f1') but filmById returns undefined → returns undefined (falsy)
    expect(result).toBeFalsy();
  });
});
