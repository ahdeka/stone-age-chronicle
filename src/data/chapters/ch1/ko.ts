// 1장 한국어 문자열. 키 규약은 DESIGN.md §5.2.

import { ch1KoActions } from './koActions';
import { ch1KoEvents } from './koEvents';

export const ch1Ko: Record<string, string> = {
  ...ch1KoEvents,
  ...ch1KoActions,
  'chapter.ch1.title': '첫 장: 돌과 씨앗',
  'scale.band': '무리',
  'tribe.ch1.default': '솔바람 사람들',

  // 시대
  'era.paleolithic.name': '뗀돌의 시대',
  'era.neolithic.name': '간돌의 시대',

  // 자원
  'resource.food.name': '식량',
  'resource.tools.name': '도구',
  'resource.lore.name': '전승',
  'resource.cohesion.name': '결속',

  // 가치 축: neg = 음수 쪽 끝, pos = 양수 쪽 끝
  'axis.share_hierarchy.neg': '나눔',
  'axis.share_hierarchy.pos': '위계',
  'axis.tradition_novelty.neg': '전통',
  'axis.tradition_novelty.pos': '새로움',
  'axis.harmony_force.neg': '화합',
  'axis.harmony_force.pos': '무력',
  'axis.nomad_settle.neg': '유랑',
  'axis.nomad_settle.pos': '정착',

  // 역할
  'role.gather.name': '채집',
  'role.hunt.name': '사냥',
  'role.craft.name': '제작',
  'role.ritual.name': '의례',
  'role.guard.name': '경계',
  'source.role.gather': '채집',
  'source.role.hunt': '사냥',
  'source.role.craft': '제작',
  'source.role.ritual': '의례',

  // 계절
  'season.spring.name': '봄',
  'season.summer.name': '여름',
  'season.autumn.name': '가을',
  'season.winter.name': '겨울',

  // 생활 방식
  'lifestyle.nomadic.name': '유랑',
  'lifestyle.settled.name': '정착',

  // 생애 단계
  'stage.child.name': '아이',
  'stage.youth.name': '청년',
  'stage.adult.name': '장년',
  'stage.elder.name': '노년',

  // 지역
  'region.grey_wolf_hill.name': '잿빛늑대 언덕',

  // 인물
  'person.ch1.maru': '마루',
  'person.ch1.seori': '서리',
  'person.ch1.bawi': '바위',
  'person.ch1.ikki': '이끼',
  'person.ch1.noeul': '노을',

  // 결말
  'ending.ruin_extinct.title': '불이 꺼지다',
  'ending.ruin_extinct.text': '마지막 사람이 쓰러지고, 언덕의 불은 다시 피어오르지 않았다.',
  'ending.survive_basic.title': '살아남은 무리',
  'ending.survive_basic.text': '이야기꾼들은 말한다. 그들은 살아남았고, 그것이 첫 장의 노래다.',
};
