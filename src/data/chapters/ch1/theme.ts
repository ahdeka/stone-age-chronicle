// 1장 테마: 밤의 모닥불. 값은 화면 시안의 디자인 토큰(docs/design/design-handoff/README.md)이다.
// 명암비는 theme.test.ts가 검사한다 (긴 본문 7:1, 짧은 글자 4.5:1).

import type { ThemeDef } from '../../../engine';

export const ch1Theme: ThemeDef = {
  id: 'ember_night',
  motif: 'cave_lines',
  tokens: {
    // 바탕
    bg: '#12100e',
    'bg-deep': '#0c0b0a',
    surface: '#1c1915',
    inset: '#14110e',
    sheet: '#191613',
    raised: '#2a241d',
    border: '#2e2821',
    'border-strong': '#4a3e30',
    'border-soft': '#3a3229',
    'border-hover': '#6b5a44',
    'button-line': '#5a4d3c',
    // 글자
    text: '#f1e8d8',
    prose: '#ddd2bf',
    'prose-strong': '#ebe1d0',
    quote: '#e6dccb',
    'text-muted': '#b3a690',
    'text-faint': '#8f8370',
    'text-disabled': '#a39680',
    'text-past': '#a89c88',
    icon: '#cbbfa9',
    // 강조
    accent: '#e0a15a',
    'accent-hover': '#f0bd7f',
    'accent-ink': '#17120c',
    line: '#c9813a',
    bone: '#d9cbb2',
    // 경고와 증감
    'warn-bg': '#2a1c16',
    'warn-border': '#6b3a26',
    'warn-text': '#f2a283',
    'warn-soft': '#f6c3ad',
    'alert-bg': '#241a16',
    'alert-border': '#5a3426',
    'alert-text': '#e6c9bb',
    up: '#9fd0a8',
    down: '#f2a283',
    // 위험 배지
    'risk-sure-bg': '#1d2a33',
    'risk-sure': '#a9cde3',
    'risk-fair-bg': '#2e2817',
    'risk-fair': '#e6cd86',
    'risk-risky-bg': '#38201a',
    'risk-risky': '#f2a283',
    'risk-unknown-bg': '#28223a',
    'risk-unknown': '#c9b8ec',
  },
};
