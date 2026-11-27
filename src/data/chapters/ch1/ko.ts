// 1장 문자열. 문체: 담담한 서술형, 구체적인 행동, 수치를 문장 안에 (DESIGN.md §12)
// 규칙(CLAUDE.md "화면 표기 원칙"): 화면 정보는 쉬운 말과 아라비아 숫자만, 달 이름과 분위기 있는 표현은 이야기 문장에서만.
// 조사는 {이름:은} 서식으로, 부족 이름은 {tribe}로만 넣는다.

import { ch1ContentKo } from './ko.content';
import { ch1SeasonKo } from './season';
import { ch1TechKo } from './tech';

const names: Record<string, string> = {
  maru: '마루', bawi: '바위', seori: '서리', noeul: '노을', ikki: '이끼',
  doljjeogwi: '돌쩌귀', galdae: '갈대', sol: '솔', yeoul: '여울', neoreok: '너럭', garam: '가람',
  beodeul: '버들', darae: '다래', iseul: '이슬', meoru: '머루', dallae: '달래', bora: '보라', nari: '나리', sandeul: '산들',
  neuti: '느티', eoksae: '억새', deunggeol: '등걸',
  dotori: '도토리', kong: '콩', saebyeok: '새벽', byeol: '별', bangul: '방울', gaeam: '개암', noru: '노루',
  daram: '다람', achim: '아침', gureum: '구름', ssari: '싸리', jindal: '진달',
};

export const ch1Ko: Record<string, string> = {
  ...ch1ContentKo,
  ...ch1SeasonKo,
  ...ch1TechKo,
  // 시작 화면의 추천 부족 이름 (첫 번째가 기본값)
  'tribe.suggest.grey_river': '잿빛강 사람들',
  'tribe.suggest.willow_brook': '버들내 사람들',
  'tribe.suggest.white_ford': '흰여울 사람들',
  'tribe.suggest.dawn_fire': '새벽불 부족',
  ...Object.fromEntries(Object.entries(names).map(([id, n]) => [`person.${id}`, n])),

  // ── 시간과 날씨 ──
  'month.thaw': '녹는달', 'month.sprout': '새싹달', 'month.egg': '알달',
  'month.longday': '긴해달', 'month.hot': '뜨거운달', 'month.thunder': '천둥달',
  'month.fruit': '열매달', 'month.reindeer': '순록달', 'month.leaf': '낙엽달',
  'month.frost': '서리달', 'month.snow': '눈달', 'month.ice': '얼음달',
  'season.spring': '봄', 'season.summer': '여름', 'season.autumn': '가을', 'season.winter': '겨울',
  'weather.clear': '맑음', 'weather.frost': '서리', 'weather.rain': '비', 'weather.fog': '안개',
  'weather.drought': '가뭄', 'weather.snow': '눈', 'weather.cold_snap': '한파', 'weather.blizzard': '눈보라',

  // ── 장소와 동물 ──
  'place.river_bend': '잿빛강 굽이', 'place.reindeer_ford': '초원의 여울', 'place.east_steppe': '동쪽 초원',
  'place.north_forest': '북쪽 소나무 숲', 'place.north_cave': '북쪽 숲의 바위굴', 'place.south_marsh': '남쪽 늪지',
  'place.reed_lake': '갈대호수',
  'animal.reindeer.migrating': '순록 떼가 초원을 지나 남쪽으로 내려가고 있다. 오래 머물지 않는다.',
  'animal.reindeer.north': '순록 떼는 북쪽 먼 곳에 있다.',
  'animal.reindeer.south': '순록 떼는 남쪽으로 떠났다.',
  'animal.wolves.near_camp': '늑대 무리가 마을 가까이 있다. 강가 진흙에 발자국이 많다.',
  'animal.wolves.roaming': '늑대 무리는 멀리 떠돈다.',
  'animal.bear.active': '북쪽 숲에서 곰의 흔적이 보인다.',
  'animal.bear.denning': '곰은 겨울잠에 들었다.',
  'animal.red_deer.scattered': '붉은사슴들은 숲 여기저기 흩어져 있다.',
  'animal.red_deer.river_crossing': '붉은사슴들이 얼어붙은 강가로 내려와 있다.',

  // ── 물자, 병, 앎 ──
  'res.hide': '가죽', 'res.bear_hide': '곰 가죽', 'res.spear': '돌창', 'res.knife': '돌칼', 'res.net': '그물',
  // 이달의 결과 "이달 말" 상자의 수량 (화면 정보: 아라비아 숫자)
  'unit.hide': '{n}장', 'unit.bear_hide': '{n}장', 'unit.spear': '{n}자루', 'unit.knife': '{n}개', 'unit.net': '{n}개', 'unit.willow_bark': '{n}묶음',
  'food.raw_meat': '날고기', 'food.dried_meat': '말린 고기', 'food.dried_fish': '말린 물고기', 'food.fish': '물고기', 'food.roots': '뿌리와 열매',
  'shelter.tent': '가죽 천막', 'shelter.rock_cave': '바위굴', 'shelter.pit_house': '움집',
  'ailment.fracture': '뼈가 부러짐', 'ailment.claw': '깊게 할퀸 상처', 'ailment.frostbite': '동상',
  'ailment.cough': '기침', 'ailment.fever': '열병',
  'cause.fracture': '부러진 뼈', 'cause.claw': '할퀸 상처', 'cause.frostbite': '동상', 'cause.cough': '기침', 'cause.fever': '열병',
  'knowledge.meat_drying': '고기 말리기', 'knowledge.sled': '끌개 엮기', 'knowledge.storage_pit': '저장 구덩이',
  'knowledge.ice_fishing': '얼음 낚시', 'knowledge.fur_clothes': '가죽옷 짓기',
  'facility.wood_shed': '장작 덧집',
  'clue.deer_cross_river': '서리의 옛이야기: 겨울 끝자락엔 사슴이 강을 건너러 내려온다.',
  'seat.hunt_leader': '사냥 우두머리', 'seat.elder': '이야기꾼', 'seat.healer': '약초꾼', 'seat.artisan': '장인',
  'stance.bold': '대담', 'stance.cautious': '신중', 'stance.practical': '실용', 'stance.inventive': '기술',

  // ── 결말과 연대기 ──
  'ending.ruin_extinct.title': '꺼진 불',
  'ending.ruin_extinct.chron': '{tribe}의 마지막 불이 꺼졌다.',
  'ending.ruin_split.title': '흩어진 사람들',
  'ending.ruin_split.chron': '{tribe:은} 서로를 믿지 못해 뿔뿔이 흩어졌다.',
  'ending.neolithic.title': '새 시대의 문턱',
  'ending.neolithic.chron': '{tribe:은} 두 갈래의 끝에 닿아 새 시대의 문턱에 섰다.',
  'ending.survive_time.title': '살아남은 사람들',
  'ending.survive_time.chron': '{tribe:은} 여러 해를 견뎌 냈다.',
  'chron.death': '{name}, {cause} 끝에 세상을 떠났다.',
  'chron.mourning': '부족은 {name:을} 강가 언덕에 묻고 밤새 불을 지켰다.',
  'chron.knowledge': '부족이 새로운 앎을 얻었다: {knowledge}.',
  'chron.built': '부족이 새로 지은 것: {facility}.',
  'chron.policy': '이달의 일: {policy}.',
  'chron.strangers_trade': '갈대호수 사람들과 처음 물건을 바꿨다. 그들은 얼음이 녹으면 다시 오겠다고 했다.',
  // ── 달의 계절감 ──
  'month.thaw.when': '이른 봄', 'month.sprout.when': '봄', 'month.egg.when': '늦봄',
  'month.longday.when': '이른 여름', 'month.hot.when': '한여름', 'month.thunder.when': '늦여름',
  'month.fruit.when': '이른 가을', 'month.reindeer.when': '가을', 'month.leaf.when': '늦가을',
  'month.frost.when': '초겨울', 'month.snow.when': '한겨울', 'month.ice.when': '늦겨울',

  // ── 부상·병의 영향 ──
  'ailment.fracture.effect': '몇 달 동안 걷지 못한다.',
  'ailment.claw.effect': '한동안 일하지 못한다.',
  'ailment.frostbite.effect': '손발이 나을 때까지 일하지 못한다.',
  'ailment.cough.effect': '누워 지내야 한다. 굶주리면 위험하다.',
  'ailment.fever.effect': '열이 내릴 때까지 누워 있어야 한다.',

  // ── 마을 일 서술 ──
  'nar.village_work.autumn.1': '남은 어른 {villagers:count}명은 강가에서 뿌리를 캐고 마른 가지를 모았다. 장작 {wood}kg, 먹을거리 {gathered}kg.',
  'nar.village_work.autumn.2': '마을에서는 {villagers:count}명이 마른 가지를 꺾고 강가를 뒤졌다. 장작 {wood}kg과 먹을거리 {gathered}kg이 모였다.',
  'nar.village_work.blizzard': '눈보라 속에서는 천막 밖으로 나가기도 어려웠다. 장작 {wood}kg을 겨우 모았다.',
  'nar.village_work.winter.1': '눈을 헤치고 {villagers:count}명이 땔감을 끌어왔다. 장작 {wood}kg. 언 땅에서 건진 먹을거리는 {gathered}kg뿐이었다.',
  'nar.village_work.winter.2': '어른들은 무릎까지 빠지는 눈 속에서 마른 가지를 꺾었다. 장작 {wood}kg, 먹을거리 {gathered}kg.',
  'nar.village_work.warm.1': '어른들은 강가와 늪을 돌며 먹을거리 {gathered}kg과 장작 {wood}kg을 모았다.',
  'nar.village_work.warm.2': '{villagers:count}명이 물가에 그물을 놓고 새순을 뜯었다. 먹을거리 {gathered}kg, 장작 {wood}kg.',
  // 계절 턴 진행 화면: 마을 일의 수치 없는 변형 (§B2.3, 수치는 이 철의 결과에만)
  'nar.village_work.autumn.1.season': '남은 어른들은 강가에서 뿌리를 캐고 마른 가지를 모았다.',
  'nar.village_work.autumn.2.season': '마을에서는 마른 가지를 꺾고 강가를 뒤졌다. 겨울에 땔 것과 먹을 것이 조금씩 쌓였다.',
  'nar.village_work.blizzard.season': '눈보라 속에서는 천막 밖으로 나가기도 어려웠다. 땔감을 겨우 끌어왔다.',
  'nar.village_work.winter.1.season': '눈을 헤치고 땔감을 끌어왔다. 언 땅에서 건진 먹을거리는 얼마 되지 않았다.',
  'nar.village_work.winter.2.season': '어른들은 무릎까지 빠지는 눈 속에서 마른 가지를 꺾었다.',
  'nar.village_work.warm.1.season': '어른들은 강가와 늪을 돌며 먹을거리와 땔감을 모았다.',
  'nar.village_work.warm.2.season': '사람들이 물가에 그물을 놓고 새순을 뜯었다.',
  'line.village.empty': '마을에는 일할 사람이 남지 않았다.',

  // ── 장부 행: 잡은 짐승 ──
  'row.catch.reindeer': '순록 {n}마리',
  'row.catch.red_deer': '붉은사슴 {n}마리',
  'row.catch.bear': '곰 {n}마리',
  'row.catch.wolves': '늑대 {n}마리',

  // ── 시대 목표 ──
  'goals.era': '시대 목표 · 구석기',
  'goal.food_stability': '식량 안정',
  'goal.food_stability.winter_fed': '겨울을 굶주림 없이 넘기기',
  'goal.food_stability.stockpile': '석 달분 비축',
  'goal.food_stability.first_harvest': '첫 수확',
  'goal.permanent_home': '영구 거처',
  'goal.permanent_home.cave_base': '바위굴을 거점으로',
  'goal.permanent_home.pit_village': '움집 마을',
  'goal.permanent_home.river_camp': '강가 고정 야영지',
  'goal.expansion': '부족의 확장',
  'goal.expansion.marriage': '혼인 동맹',
  'goal.expansion.trade_vassal': '교역으로 산하에',
  'goal.expansion.conquest': '무력',
  'goal.expansion.refugees': '떠돌이 무리 받아들이기',
};

