import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, map, ok, unwrap } from '../result.js';

describe('Result', () => {
  it('ok constructs success', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (r.ok) expect(r.value).toBe(42);
  });
  it('err constructs failure', () => {
    const e = new Error('boom');
    const r = err(e);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.error).toBe(e);
  });
  it('unwrap returns value or throws', () => {
    expect(unwrap(ok(7))).toBe(7);
    expect(() => unwrap(err(new Error('x')))).toThrow('x');
    expect(() => unwrap(err('plain string'))).toThrow('plain string');
  });
  it('map transforms ok, passes err', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    const e = err<string>('nope');
    expect(map(e, (n: number) => n + 1)).toBe(e);
  });
});
