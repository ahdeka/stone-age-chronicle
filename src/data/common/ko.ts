// 공통 한국어 문자열. 키 규약은 DESIGN.md §5.2.

export const commonKo: Record<string, string> = {
  // 시간 표시 (DESIGN.md §3.1)
  'time.reignSeason': '제{reign}대 족장 시절 · {season}',
  'time.reignSeasonShort': '제{reign}대 · {season}',
  'time.legendEnding': '전설의 끝이 가까워진다',

  // 직책
  'office.chief.name': '족장',
  'office.elder.name': '장로',
  'office.hunt_leader.name': '사냥 우두머리',
  'office.shaman.name': '샤먼',
  'office.artisan.name': '장인',

  // 인물 특성
  'trait.person.brave.name': '용맹한',
  'trait.person.cautious.name': '신중한',
  'trait.person.gentle.name': '온화한',
  'trait.person.ambitious.name': '야심 많은',
  'trait.person.stubborn.name': '고집센',
  'trait.person.pliable.name': '귀가 얇은',
  'trait.person.herbalist.name': '약초에 밝은',
  'trait.person.storyteller.name': '이야기꾼',
  'trait.person.crafty.name': '손재주',
  'trait.person.pathfinder.name': '길눈 밝은',
  'trait.person.dreamer.name': '꿈꾸는',
  'trait.person.silver_tongue.name': '말솜씨',
  'trait.person.fertile.name': '다산',
  'trait.person.frail.name': '병약한',
  'trait.person.seasoned.name': '노련한',

  // 불확실성 단서 (DESIGN.md §4.3)
  'hint.sure': '거의 확실하다',
  'hint.fair': '해볼 만하다',
  'hint.risky': '위험해 보인다',
  'hint.reckless': '무모하다',

  // 변화 출처 (턴 요약)
  'source.upkeep.food': '먹은 양식',
  'source.upkeep.tools': '닳은 도구',
  'source.spoil.food': '상한 식량',
  'source.storage.food': '쌓아 둘 곳이 없어 버린 식량',
  'source.starvation': '굶주림',
  'source.growth': '새로 태어난 아이들',
  'source.aging': '세월',
  'source.debug': '디버그',
  'mod.cohesionHigh': '결속이 높아 손이 남는다',
  'mod.cohesionLow': '결속이 낮아 일이 더디다',

  // 오류
  'error.roles.sum': '배분한 사람 수가 인구와 맞지 않는다.',
  'error.roles.invalid': '배분 값이 올바르지 않다.',
  'error.roles.unknown': '알 수 없는 역할이다.',
  'error.wrongPhase': '지금은 할 수 없다.',
  'error.gameEnded': '이야기는 이미 끝났다.',
  'error.chapterMismatch': '다른 장의 저장 파일이다.',
  'error.save.notJson': '저장 파일을 읽을 수 없다.',
  'error.save.format': '이 게임의 저장 파일이 아니다.',
  'error.save.newer': '더 새로운 버전에서 만든 저장 파일이다.',
  'error.save.noMigration': '이 저장 파일 버전은 불러올 수 없다.',
  'error.save.corrupt': '저장 파일이 손상되었다.',
  'error.save.unknownChapter': '알 수 없는 장의 저장 파일이다.',

  // UI
  'ui.title': '돌의 연대기',
  'ui.subtitle': '노래로 전해지는 한 무리의 이야기',
  'ui.newGame': '새 이야기',
  'ui.continue': '이어서',
  'ui.seed': '시드',
  'ui.seedPlaceholder': '비워 두면 무작위',
  'ui.start': '시작',
  'ui.endTurn': '계절을 보낸다',
  'ui.endTurnHint': 'Space / Enter',
  'ui.population': '인구',
  'ui.roles': '일 나누기',
  'ui.rolesUnassigned': '남은 사람',
  'ui.people': '인물',
  'ui.axes': '부족의 성향',
  'ui.lastSeason': '지난 계절에 일어난 일',
  'ui.nothingHappened': '별다른 일 없이 계절이 지나갔다.',
  'ui.export': '저장 파일 내보내기',
  'ui.import': '저장 파일 불러오기',
  'ui.ended': '이야기가 끝났다',
  'ui.stageNear': '다음 시기가 가까워 보인다',
  'ui.m1Notice': '엔진 확인용 최소 화면 (M1). 이벤트와 카드는 M2에서 들어온다.',
};
