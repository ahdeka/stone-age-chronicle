// 1장 행동 카드, 결과 단서, 잠금 힌트, 스탯·카운터 이름, 연대기 기본 문장

export const ch1KoActions: Record<string, string> = {
  'action.hunt_expedition.name': '사냥 원정',
  'action.hunt_expedition.text': '사냥꾼들을 이끌고 멀리 나간다. 사냥꾼과 도구가 많을수록 잘 된다.',
  'action.gather_trip.name': '채집 나들이',
  'action.gather_trip.text': '열매와 뿌리를 캐러 나간다. 겨울에는 찾을 것이 적다.',
  'action.explore_surroundings.name': '주변 탐색',
  'action.explore_surroundings.text': '낯선 골짜기와 물길을 살핀다. 무엇을 찾을지는 아무도 모른다.',
  'action.craft_tools.name': '도구 만들기',
  'action.craft_tools.text': '돌을 깨고 다듬어 날을 세운다. 그동안 먹을 것을 구하지 못한다.',
  'action.fire_ritual.name': '모닥불 의례',
  'action.fire_ritual.text': '불가에 모여 노래하고 춤춘다. 옛 방식이 사람들을 묶는다.',
  'action.pass_on_stories.name': '이야기 전수',
  'action.pass_on_stories.text': '노인과 이야기꾼이 옛이야기를 젊은이들에게 들려준다.',
  'action.dry_meat.name': '고기 말리기',
  'action.dry_meat.text': '고기를 연기에 말려 오래 두고 먹는다. 겨울을 앞두고 쓸모가 크다.',
  'action.scout_herds.name': '짐승 길 살피기',
  'action.scout_herds.text': '짐승들이 다니는 길을 미리 살펴 둔다. 이번 계절과 다음 계절의 사냥이 잘 된다.',
  'action.share_feast.name': '잔치',
  'action.share_feast.text': '쌓아 둔 고기를 모두 함께 먹는다. 배보다 마음이 먼저 부르다.',
  'action.share_feast.chron': '잔치를 열어 모든 이가 같은 불가에서 같은 고기를 먹었다.',
  'action.post_watch.name': '경계 세우기',
  'action.post_watch.text': '밤마다 돌아가며 불침번을 선다. 맹수와 낯선 이에 맞설 힘이 된다.',

  // 효과 안에서 남기는 연대기
  'chron.hunt.big': '사냥꾼들이 큰 짐승을 메고 돌아와 모두가 배불리 먹었다.',

  // 무작위 결과 단서 (DESIGN.md §4.3: 내용은 "있을 수 있다"로만)
  'outcome.injury': '누군가 다칠 수 있다',
  'outcome.badMushroom': '독버섯을 먹을 수 있다',
  'outcome.berries': '먹을 것을 찾을 수 있다',
  'outcome.oldCamp': '옛 흔적을 찾을 수 있다',
  'outcome.fall': '누군가 떨어질 수 있다',
  'outcome.weakest': '약한 이가 쓰러질 수 있다',
  'outcome.cold': '추위에 잃을 수 있다',
  'outcome.lost': '길을 잃는 이가 있을 수 있다',
  'outcome.sick': '병자를 잃을 수 있다',
  'outcome.garbled': '노래가 틀리게 전해질 수 있다',
  'outcome.childLeaves': '아이가 떠날 수 있다',
  'outcome.childStays': '아이가 남을 수 있다',
  'outcome.ambush': '앙갚음을 당할 수 있다',

  // 잠금 힌트
  'lock.need_elder': '장로가 있어야 한다',
  'lock.prepared_winter': '겨울 채비를 해 두었다면…',
  'lock.need_herbalist': '약초에 밝은 사람이 있어야 한다',
  'lock.need_brave': '용맹한 사람이어야 한다',
  'lock.need_peacemaker': '이야기꾼, 온화한 사람, 말솜씨 좋은 사람 중 하나가 있어야 한다',
  'lock.need_storyteller_or_elder': '이야기꾼이나 노인이 있어야 한다',

  // 스탯과 카운터 이름 (미리보기에 쓰인다)
  'stat.yield.hunt': '사냥',
  'stat.yield.gather': '채집',
  'stat.yield.craft': '제작',
  'stat.spoil.food': '식량 상함',
  'stat.storage.food.perPop': '저장 한도',
  'stat.consume.food': '먹는 양',
  'stat.watch': '경계 태세',
  'counter.great_tales': '위대한 이야기',
  'counter.tales_told': '전한 이야기',
  'counter.seed_signs': '씨앗의 징조',
  'counter.explored': '탐색',

  // 연대기 기본 문장 (그 계절에 특별한 일이 없을 때)
  'chron.quiet.hungry.1': '배고픈 계절이었다. 사람들은 말수가 줄었다.',
  'chron.quiet.hungry.2': '빈 배를 안고 사람들은 다음 계절을 기다렸다.',
  'chron.quiet.winter.1': '사람들은 불 곁에서 긴 밤을 났다.',
  'chron.quiet.winter.2': '눈 덮인 언덕 아래서 무리는 조용히 겨울을 견뎠다.',
  'chron.quiet.1': '별다른 일 없이 계절이 흘렀다.',
  'chron.quiet.2': '사람들은 사냥하고, 줍고, 노래했다.',
  'chron.quiet.3': '아이들이 자랐고, 노인들은 같은 이야기를 또 했다.',
  'chron.quiet.4': '무리는 늘 하던 대로 살았다.',
};
