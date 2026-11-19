// npm run validate:content — 모든 장의 콘텐츠를 검사한다. 오류가 하나라도 있으면 exit 1.

import { chapters, commonStrings } from '../src/data/registry';
import { validateChapter } from './lib/validate';

let errors = 0;
let warnings = 0;

for (const [id, entry] of Object.entries(chapters)) {
  const strings = { ...commonStrings.ko, ...entry.strings.ko };
  const issues = validateChapter(entry.definition, strings);
  const e = issues.filter((i) => i.level === 'error');
  const w = issues.filter((i) => i.level === 'warning');
  errors += e.length;
  warnings += w.length;
  console.log(`\n[${id}] 오류 ${e.length}, 경고 ${w.length}`);
  for (const i of issues) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '}  ${i.where}: ${i.message}`);
}

console.log(`\n합계: 오류 ${errors}, 경고 ${warnings}`);
if (errors > 0) process.exit(1);
console.log('콘텐츠 검증 통과');
