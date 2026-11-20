// npm run validate:content — 모든 장의 콘텐츠를 검사한다. 오류가 있으면 종료 코드 1.

import { chapters, commonStrings } from '../src/data/registry';
import { SCENE_IDS } from '../src/assets/sceneIds';
import { validate } from './lib/validate';

let errors = 0;
let warns = 0;
for (const [id, entry] of Object.entries(chapters)) {
  const issues = validate(entry.definition, { ...commonStrings.ko, ...entry.strings.ko }, SCENE_IDS);
  for (const i of issues) {
    console.log(`${i.level === 'error' ? 'ERROR' : 'warn '} [${id}] ${i.where}: ${i.msg}`);
    if (i.level === 'error') errors++;
    else warns++;
  }
}
console.log(`\n검증 끝: 오류 ${errors}, 경고 ${warns}`);
process.exit(errors > 0 ? 1 : 0);
