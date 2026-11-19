// 아키텍처 규칙 검사 (CLAUDE.md 아키텍처 원칙 1, 4)
// - src/engine은 React와 DOM에 의존하지 않는다
// - Math.random은 어디에서도 쓰지 않는다

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

/** 주석을 지운 소스 (주석 안의 단어로 오탐하지 않게) */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('architecture', () => {
  it('엔진은 React, DOM, 데이터, UI를 import하지 않는다', () => {
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, 'src/engine'))) {
      if (f.endsWith('.test.ts')) continue;
      const src = code(f);
      const bad =
        /from\s+['"](react|react-dom)/.test(src) ||
        /from\s+['"][./]*(\.\.\/)+(ui|data|i18n)\//.test(src) ||
        /\b(window|document|localStorage|navigator)\./.test(src);
      if (bad) offenders.push(relative(ROOT, f));
    }
    expect(offenders).toEqual([]);
  });

  it('Math.random을 쓰지 않는다', () => {
    const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tools'))].filter((f) => !f.endsWith('architecture.test.ts'));
    const offenders = files.filter((f) => /Math\.random/.test(code(f))).map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
