// 계절 턴 시험용 데이터 (B 방향 R1). 2년차부터 한 철 한 턴이 끝까지 돌아가는지 확인하는 최소 콘텐츠다.
// 본편(계절 식량 전략, 칸 12개, 인물 사건)은 R4에서 이 파일을 대신한다 (DESIGN.md §B7).
// 계절 전략의 단계(early/mid/late)는 초입·한가운데·끝자락의 달이고, 그 달 첫 순에 한 번 실행된다.

import type { EventDef, Narrative, PolicyTemplate } from '../../../engine';
import { huntCosts, huntPower } from './policies';

/** 사슴 사냥 한 단계 (그 달 첫 순): 한 철 내내 숲에 머물며 달마다 한 번씩 몰이를 한다 */
const deerStage = [
  {
    kind: 'activity' as const,
    activity: {
      power: huntPower(0.45),
      difficulty: 6.1,
      outcomes: {
        triumph: { narrative: 'deer_good', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [3, 4] as const }] },
        success: { narrative: 'deer_good', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [2, 3] as const }] },
        costly: { narrative: 'deer_good', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [1, 2] as const }] },
        failure: { narrative: 'deer_bad', effects: [{ type: 'catch' as const, animal: 'red_deer', count: [0, 1] as const }] },
        disaster: { narrative: 'deer_bad', effects: [] },
      },
      costs: huntCosts,
    },
  },
  { kind: 'carry' as const },
];

export const ch1SeasonPolicies: PolicyTemplate[] = [
  {
    // 한 철 내내 마을 가까이에서 일한다 (원정 없음). 계절 턴의 버티기 자리
    id: 'season_camp_work',
    slot: 'food',
    turn: 'season',
    category: 'gather',
    appearsWhen: [],
    priority: 40,
    cooldown: 0,
    fallback: true,
    scene: { bg: '{camp}', subjects: ['sub.gatherers'], overlay: '{weather}' },
    steps: {
      early: [{ kind: 'narrate', narrative: 'season_camp' }],
      late: [{ kind: 'narrate', narrative: 'season_camp' }],
    },
  },
  {
    // 한 철 동안 숲에 사냥대를 둔다 (달마다 몰이 한 번, 가까워 여러 번 나른다)
    id: 'season_forest_hunt',
    slot: 'food',
    turn: 'season',
    category: 'hunt',
    appearsWhen: [],
    priority: 36,
    cooldown: 0,
    crew: { min: 4, max: 6, keepHome: 5, prefer: 'hunt' },
    place: 'north_forest',
    leader: { seat: 'hunt_leader', ailing: false },
    scene: { bg: '{place}', subjects: ['sub.deer', 'sub.hunters'], overlay: '{weather}' },
    steps: { early: deerStage, mid: deerStage, late: deerStage },
  },
];

export const ch1SeasonEvents: EventDef[] = [
  {
    // 한가운데 인물 사건 창의 시험용 사건 (결정 대기 확인). 본편 인물 사건은 R3·R4
    id: 'season_fireside',
    scope: 'person',
    slots: ['mid'],
    when: [],
    weight: 1,
    cooldown: 0,
    scene: { bg: '{camp}', subjects: ['sub.fire_circle'], overlay: '{weather}' },
    speakers: [
      { who: { seat: 'elder' }, line: 'event.season_fireside.say.seori' },
      { who: { seat: 'hunt_leader' }, line: 'event.season_fireside.say.bawi' },
    ],
    options: [
      {
        // 불을 크게 피우고 이야기를 나눈다: 장작을 쓰고 결속이 오른다
        id: 'big_fire',
        hint: 'sure',
        narrative: 'season_fireside_fire',
        effects: [
          { type: 'firewood', kg: -40 },
          { type: 'cohesion', delta: 2 },
        ],
      },
      {
        // 불을 아낀다: 대가는 없지만 결속도 오르지 않는다 (기회비용)
        id: 'save_wood',
        hint: 'sure',
        narrative: 'season_fireside_quiet',
        effects: [{ type: 'flag', id: 'opportunity.fireside_skipped', set: true }],
      },
    ],
  },
];

export const ch1SeasonNarratives: Narrative[] = [
  { id: 'season_camp', variants: [{ text: 'nar.season_camp.1' }, { text: 'nar.season_camp.2' }] },
  { id: 'season_fireside_fire', variants: [{ text: 'nar.season_fireside_fire.1' }] },
  { id: 'season_fireside_quiet', variants: [{ text: 'nar.season_fireside_quiet.1' }] },
];

export const ch1SeasonKo: Record<string, string> = {
  'policy.season_camp_work.name': '마을 가까이에서 한 철',
  'policy.season_camp_work.summary': '멀리 나가지 않고 한 철 내내 거처 둘레에서 캐고 줍고 낚는다.',
  'policy.season_camp_work.brief': '거처 둘레에서 한 철을 난다.',
  'policy.season_camp_work.cost': '위험은 적지만 거두는 양도 많지 않다.',
  'policy.season_forest_hunt.name': '한 철 숲 사냥',
  'policy.season_forest_hunt.summary': '사냥대를 북쪽 숲에 한 철 두고 달마다 사슴을 몬다.',
  'policy.season_forest_hunt.brief': '숲에서 달마다 사슴을 몬다.',
  'policy.season_forest_hunt.cost': '사냥꾼이 한 철 내내 마을 일에서 빠진다. 다칠 수 있다.',
  'nar.season_camp.1': '사람들은 거처에서 반나절 걸음 안쪽만 오갔다. 뿌리를 캐고 덫을 살피며 날을 보냈다.',
  'nar.season_camp.2': '멀리 나가는 사람은 없었다. 아이들까지 나서서 강가의 돌 밑을 뒤졌다.',
  'event.season_fireside.title': '불가의 긴 밤',
  'event.season_fireside.lead': '해가 지자 사람들이 불가로 모여들었다.',
  'event.season_fireside.text': '철이 반쯤 지난 밤, 사람들이 불가에 모여 앉았다. 누군가 불을 더 키우자고 했고, 누군가는 장작을 아끼자고 했다.',
  'event.season_fireside.say.seori': '불이 크면 이야기도 길어집니다. 한 밤쯤은 괜찮습니다.',
  'event.season_fireside.say.bawi': '장작은 겨울에 쓸 몫입니다. 지금 태울 것이 아닙니다.',
  'event.season_fireside.opt.big_fire': '불을 크게 피운다',
  'event.season_fireside.opt.big_fire.cost': '장작 40kg · 결속이 조금 오름',
  'event.season_fireside.opt.save_wood': '장작을 아낀다',
  'event.season_fireside.opt.save_wood.cost': '대가 없음 · 결속이 오르지 않음',
  'nar.season_fireside_fire.1': '불길이 높이 올랐다. 노인들이 늦도록 옛이야기를 했고 아이들은 불가에서 잠들었다.',
  'nar.season_fireside_quiet.1': '불은 작게 남았다. 사람들은 일찍 천막으로 들어갔다.',
};
