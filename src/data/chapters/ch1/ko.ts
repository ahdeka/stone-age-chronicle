// 1장 문자열. 문체: 담담한 서술형, 구체적인 행동, 수치를 문장 안에 (DESIGN.md §12)
// 규칙: 받침에 따라 바뀌는 조사를 변수 바로 뒤에 붙이지 않는다.

const names: Record<string, string> = {
  maru: '마루', bawi: '바위', seori: '서리', noeul: '노을', ikki: '이끼',
  doljjeogwi: '돌쩌귀', galdae: '갈대', sol: '솔', yeoul: '여울', neoreok: '너럭', garam: '가람',
  beodeul: '버들', darae: '다래', iseul: '이슬', meoru: '머루', dallae: '달래', bora: '보라', nari: '나리', sandeul: '산들',
  neuti: '느티', eoksae: '억새', deunggeol: '등걸',
  dotori: '도토리', kong: '콩', saebyeok: '새벽', byeol: '별', bangul: '방울', gaeam: '개암', noru: '노루',
  daram: '다람', achim: '아침', gureum: '구름', ssari: '싸리', jindal: '진달',
};

export const ch1Ko: Record<string, string> = {
  'tribe.name': '잿빛강 사람들',
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
  'food.raw_meat': '날고기', 'food.dried_meat': '말린 고기', 'food.dried_fish': '말린 물고기', 'food.fish': '물고기', 'food.roots': '뿌리와 열매',
  'shelter.tent': '가죽 천막', 'shelter.rock_cave': '바위굴', 'shelter.pit_house': '움집',
  'ailment.fracture': '뼈가 부러짐', 'ailment.claw': '깊게 할퀸 상처', 'ailment.frostbite': '동상',
  'ailment.cough': '기침', 'ailment.fever': '열병',
  'cause.fracture': '부러진 뼈', 'cause.claw': '할퀸 상처', 'cause.frostbite': '동상', 'cause.cough': '기침', 'cause.fever': '열병',
  'knowledge.meat_drying': '고기 말리기', 'knowledge.sled': '끌개 엮기', 'knowledge.storage_pit': '저장 구덩이',
  'knowledge.ice_fishing': '얼음 낚시', 'knowledge.fur_clothes': '가죽옷 짓기',
  'clue.deer_cross_river': '서리의 옛이야기: 겨울 끝자락엔 사슴이 강을 건너러 내려온다.',
  'seat.hunt_leader': '사냥 우두머리', 'seat.elder': '이야기꾼', 'seat.healer': '약초꾼', 'seat.artisan': '장인',
  'stance.bold': '대담', 'stance.cautious': '신중', 'stance.practical': '실용', 'stance.inventive': '기술',

  // ── 방침 ──
  'policy.reindeer_big_hunt.name': '순록 떼 대사냥',
  'policy.reindeer_big_hunt.summary': '성인 {crew}명을 초원의 여울로 보낸다. 마을은 비고 겨울 준비가 늦어진다.',
  'policy.river_gather.name': '강가 어로와 채집',
  'policy.river_gather.summary': '가까운 강가와 늪에서 뿌리와 물고기를 조금씩 모은다.',
  'policy.winter_prep.name': '겨울 준비 우선',
  'policy.winter_prep.summary': '마을 일손 대부분이 마른 가지와 장작을 모은다.',
  'policy.hold_and_ration.name': '배급을 줄이고 버틴다',
  'policy.hold_and_ration.summary': '모두 4분의 3만 먹으며 아낀다. 약한 사람부터 지친다.',
  'policy.recover_cache.name': '여울의 고기 회수',
  'policy.recover_cache.summary': '{crew}명이 돌무더기 아래 묻어 둔 고기를 찾으러 간다.',

  // ── 사건 ──
  'event.herd_vs_wolves.title': '두 소식이 한꺼번에',
  'event.herd_vs_wolves.text': '본 무리가 이틀 뒤 여울에 닿는다는 소식이 왔다. 같은 날 저녁, 늑대들이 밤마다 천막 주위를 돈다는 전갈이 마을에서 왔다.',
  'event.herd_vs_wolves.say.leader': '결정해 주십시오.',
  'event.herd_vs_wolves.opt.stay_all': '전원 매복 유지',
  'event.herd_vs_wolves.opt.send_back': '몇 명을 돌려보낸다',
  'event.herd_vs_wolves.opt.keep_fires': '마을에 큰 불을 피운다',
  'event.herd_vs_wolves.opt.call_off': '사냥 중단, 귀환',
  'event.herd_vs_wolves.res.send_back': '사냥꾼 넷이 밤길을 걸어 마을로 돌아갔다. 매복 줄이 얇아졌다.',
  'event.herd_vs_wolves.res.keep_fires': '마을은 천막 둘레에 불 세 개를 피우고 교대로 밤을 지켰다. 늑대들은 불빛 가장자리에서 돌아섰다.',

  'event.wolves_circle_camp.title': '불빛 가장자리의 눈',
  'event.wolves_circle_camp.text': '밤마다 천막 너머에서 눈빛이 번득인다. 어젯밤에는 말리던 고기 한 줄이 사라졌다.',
  'event.wolves_circle_camp.opt.fires': '큰 불을 피운다',
  'event.wolves_circle_camp.opt.watch': '교대로 밤을 지킨다',
  'event.wolves_circle_camp.opt.ignore': '그냥 둔다',
  'event.wolves_circle_camp.res.fires': '불 셋을 밤새 지폈다. 장작이 빠르게 줄었지만 늑대는 물러갔다.',
  'event.wolves_circle_camp.res.watch': '어른들이 돌아가며 밤을 지켰다. 낮에는 다들 졸았다.',

  'event.strangers_smoke.title': '낯선 사람들',
  'event.strangers_smoke.text': '털가죽을 두른 여섯 명이 연기를 보고 찾아왔다. 남쪽 늪지 너머 호숫가의 갈대호수 사람들이다. 짐 속에 말린 물고기가 가득하다.',
  'event.strangers_smoke.opt.trade_hides': '가죽 10장과 바꾼다',
  'event.strangers_smoke.opt.decline': '정중히 돌려보낸다',

  'event.reed_lake_return.title': '얼음이 녹으면, 다시',
  'event.reed_lake_return.text': '강 얼음이 풀리자 갈대호수 사람들이 약속대로 돌아왔다. 이번에는 물고기를 말리는 틀도 메고 왔다.',
  'event.reed_lake_return.opt.trade': '가죽 5장과 바꾼다',
  'event.reed_lake_return.opt.learn': '말리는 법을 배운다',

  'line.wolves_took': '늑대가 말리던 고기를 물어 갔다.',
  'line.wolves_circled': '늑대들이 밤새 천막 주위를 돌았다. 아이들이 무서워 잠을 못 잤다.',
  'line.spears_broken': '창 몇 자루가 부러졌다.',

  // ── 서술 ──
  'nar.ambush_good.1': '사냥대는 나흘을 걸어 순록 이동로에 닿았다. 얕은 여울 양쪽 갈대밭에 엎드려 첫 무리를 덮쳤다. 순록 {caught}마리가 쓰러졌다.',
  'nar.ambush_good.2': '{leader} 우두머리가 바람을 읽고 사냥대를 갈대밭 아래로 옮겼다. 첫 매복에서 순록 {caught}마리를 잡았다.',
  'nar.ambush_bad.1': '순록들이 먼저 냄새를 맡고 여울을 비껴갔다. 첫 매복은 빈손에 가까웠다.',
  'nar.herd_good.1': '본 무리가 여울에 닿자 양쪽에서 창이 날았다. 순록 {caught}마리, 고기 약 {meat}kg이었다.',
  'nar.herd_good.2': '수백 마리가 물을 건너는 사이 사냥대는 쉬지 않고 창을 던졌다. 저녁까지 순록 {caught}마리를 끌어냈다.',
  'nar.herd_costly.1': '본 무리를 덮쳐 순록 {caught}마리를 쓰러뜨렸다. 그러나 무리에 떠밀린 사람들이 물속에서 넘어졌다.',
  'nar.herd_bad.1': '본 무리는 여울 아래쪽으로 방향을 틀었다. 순록 {caught}마리만 건졌다.',
  'nar.hunt_called_off.1': '사냥대는 매복을 풀고 마을로 돌아섰다. 등 뒤에서 본 무리가 여울을 건너는 소리가 들렸다.',
  'nar.gather_month.1': '어른들은 강가에서 뿌리를 캐고 얕은 물에 그물을 놓았다. 양은 적었지만 다치는 사람은 없었다.',
  'nar.gather_month.2': '노을이 늪 가장자리에서 먹을 수 있는 뿌리를 골라 주었다. 아이들도 바구니를 들고 따라다녔다.',
  'nar.prep_month.1': '어른들은 마른 가지를 꺾어 천막 뒤에 높이 쌓았다. 서리는 아이들에게 불씨를 꺼뜨리지 않는 법을 가르쳤다.',
  'nar.prep_month.2': '쓰러진 소나무를 끌어와 잘게 쪼갰다. 손바닥이 갈라졌지만 장작더미는 높아졌다.',
  'nar.hold_month.1': '사냥도 먼 길도 없이 불가에 모여 지냈다. 고기는 얇게 썰어 나눴고, 다들 말이 줄었다.',
  'nar.cache_found.1': '돌무더기는 그대로였다. 언 고기를 꺼내 짊어졌다.',
  'nar.cache_gone.1': '돌무더기가 파헤쳐져 있었다. 뼈와 늑대 발자국만 남았다.',

  // ── 결말과 연대기 ──
  'ending.ruin_extinct.title': '꺼진 불',
  'ending.ruin_extinct.chron': '잿빛강 사람들의 마지막 불이 꺼졌다.',
  'ending.ruin_split.title': '흩어진 사람들',
  'ending.ruin_split.chron': '잿빛강 사람들은 서로를 믿지 못해 뿔뿔이 흩어졌다.',
  'ending.survive_time.title': '살아남은 사람들',
  'ending.survive_time.chron': '잿빛강 사람들은 여러 해를 견뎌 냈다.',
  'chron.death': '{name}, {cause} 끝에 세상을 떠났다.',
  'chron.knowledge': '부족이 새로운 앎을 얻었다: {knowledge}.',
  'chron.policy': '이달의 일: {policy}.',
  'chron.strangers_trade': '갈대호수 사람들과 처음 물건을 바꿨다. 그들은 얼음이 녹으면 다시 오겠다고 했다.',
};
