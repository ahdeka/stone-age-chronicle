// 장면 레이어 (동굴벽화풍 인라인 SVG). 모두 같은 좌표계 viewBox 0 0 1200 440에 그린다.
// 배경(bg) → 대상(sub) → 날씨 덮개(ov) 순으로 겹친다. 그라디언트 id는 장면마다 uid로 구분한다.
// 모양의 방향은 화면 시안(docs/design/design-handoff)의 SVG를 따른다.

import type { CSSProperties } from 'react';
import s from './scene.module.css';

export interface LayerProps {
  uid: string;
}

const delay = (sec: number): CSSProperties => ({ animationDelay: `${sec}s` });

// ── 작은 그림들 ──

/** 풀을 뜯는 순록 (시안 TurnModal) */
function Grazer({ x, y, k = 1.2 }: { x: number; y: number; k?: number }) {
  return (
    <path
      className={s.lnThin}
      transform={`translate(${x} ${y}) scale(${k})`}
      d="M0 0 q18 -8 34 0 M10 0 v14 M28 0 v14 M0 -4 l-6 -12 l4 -2 M-6 -16 l-6 -4 M-6 -16 l2 -8"
    />
  );
}

/** 달리는 순록 (시안 Phase) */
function Runner({ x, y }: { x: number; y: number }) {
  return (
    <path
      className={s.lnThin}
      transform={`translate(${x} ${y})`}
      d="M0 0 q20 -10 40 0 M8 0 l-4 18 M14 0 l4 18 M30 0 l-4 18 M36 0 l4 18 M0 -4 l-8 -16 M-8 -20 l-8 -6 M-8 -20 l2 -12 M-8 -20 l-14 2"
    />
  );
}

/** 창을 든 사람 */
function Hunter({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const d = flip ? -1 : 1;
  return (
    <g>
      <circle cx={x} cy={y - 34} r={6} fill="#c9813a" />
      <path className={s.ln} d={`M${x} ${y - 26} L${x} ${y} M${x} ${y - 20} l${18 * d} -22 M${x} ${y} l-6 14 M${x} ${y} l6 14`} />
    </g>
  );
}

/** 허리를 굽혀 캐는 사람과 바구니 */
function Gatherer({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 10} cy={y - 26} r={6} fill="#c9813a" />
      <path className={s.ln} d={`M${x + 6} ${y - 20} q-6 8 -14 12 M${x - 8} ${y - 8} l-4 22 M${x - 8} ${y - 8} l6 22 M${x + 4} ${y - 16} l8 14`} />
      <path className={s.lnBone} d={`M${x + 16} ${y + 8} q8 10 16 0 M${x + 16} ${y + 8} h16`} />
    </g>
  );
}

/** 늑대 */
function Wolf({ x, y }: { x: number; y: number }) {
  return (
    <path
      className={s.ln}
      transform={`translate(${x} ${y})`}
      d="M0 0 q22 -8 44 0 M6 0 l-3 16 M14 0 l3 16 M34 0 l-3 16 M42 0 l3 16 M44 0 l10 -8 l12 2 l-8 6 M54 -8 l2 -8 l4 6 M0 0 q-12 2 -18 10"
    />
  );
}

/** 짐을 진 낯선 사람 (뼈색 선으로 부족 사람과 구분) */
function Stranger({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y - 34} r={6} fill="#d9cbb2" opacity={0.85} />
      <path className={s.lnStranger} d={`M${x} ${y - 26} L${x} ${y} M${x} ${y} l-6 14 M${x} ${y} l6 14 M${x} ${y - 20} l10 10`} />
      <rect x={x - 16} y={y - 30} width={12} height={18} rx={4} fill="#3a3226" stroke="#d9cbb2" strokeOpacity={0.6} />
    </g>
  );
}

function Tent({ x, base, w, h }: { x: number; base: number; w: number; h: number }) {
  const l = x - w / 2;
  const r = x + w / 2;
  return (
    <g>
      <path d={`M${l} ${base} L${x} ${base - h} L${r} ${base} Z`} fill="#2c2219" />
      <path className={s.ln} d={`M${l} ${base} L${x} ${base - h} L${r} ${base} M${x} ${base - h} L${x} ${base}`} />
    </g>
  );
}

function Pine({ x, base, h, fill }: { x: number; base: number; h: number; fill: string }) {
  const w = h * 0.32;
  return <path d={`M${x - w} ${base} L${x} ${base - h} L${x + w} ${base} Z M${x - 2} ${base} h4 v8 h-4 Z`} fill={fill} />;
}

function Reeds({ xs, base, tall }: { xs: number[]; base: number; tall: number }) {
  return (
    <g>
      {xs.map((x, i) => (
        <path key={x} className={`${s.lnReed} ${s.reed}`} style={delay((i * 0.45) % 1.6)} d={`M${x} ${base} L${x + (i % 2 ? -8 : 8)} ${base - tall + (i % 3) * 10}`} />
      ))}
    </g>
  );
}

function Sky({ uid, id, stops }: { uid: string; id: string; stops: [number, string][] }) {
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-${id}`} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="440" fill={`url(#${uid}-${id})`} />
    </>
  );
}

// ── 배경 ──

/** 해 질 녘 초원과 강 (시안 TurnModal의 월초 장면) */
export function BgSteppe({ uid }: LayerProps) {
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#1a1716'], [0.6, '#3b2a1d'], [1, '#5a3a20']]} />
      <circle cx="930" cy="120" r="52" fill="#e7a05a" opacity="0.35" />
      <path d="M0 250 L110 190 L200 230 L320 160 L430 220 L560 180 L670 240 L810 170 L940 230 L1070 190 L1200 220 L1200 440 L0 440 Z" fill="#241d19" />
      <path d="M0 330 C190 300 360 320 550 296 C740 272 910 300 1200 286 L1200 320 C910 334 740 306 550 330 C360 354 190 334 0 364 Z" fill="#2a2e31" />
      <path className={s.lnBone} d="M30 336 C200 308 360 326 550 304 M670 290 C820 300 980 296 1180 292" />
      <path d="M0 440 L0 372 C240 362 480 382 720 368 C960 354 1080 374 1200 362 L1200 440 Z" fill="#100e0c" />
    </g>
  );
}

/** 초원의 여울: 넓은 하늘, 얕은 물 (시안 Phase의 상순 장면) */
export function BgRiverFord({ uid }: LayerProps) {
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#2a2621'], [0.7, '#6a4a2a'], [1, '#8a5a2c']]} />
      <circle cx="300" cy="150" r="54" fill="#f0b46a" opacity="0.45" />
      <path d="M0 230 L120 200 L260 222 L420 190 L600 216 L780 186 L960 214 L1200 196 L1200 440 L0 440 Z" fill="#3a2b1f" />
      <path d="M0 280 C200 266 400 284 600 270 C800 256 1000 276 1200 262 L1200 440 L0 440 Z" fill="#2a1f17" />
      <path d="M0 330 C180 312 360 344 560 322 C760 300 960 330 1200 312 L1200 362 C960 380 760 350 560 372 C360 394 180 362 0 384 Z" fill="#33424a" />
      <path className={s.lnBone} d="M20 344 C200 326 360 356 560 334 M640 320 C800 306 980 330 1180 318" />
      <path d="M0 440 L0 396 C200 386 400 402 600 392 C800 382 1000 398 1200 388 L1200 440 Z" fill="#1a1410" />
    </g>
  );
}

/** 강 굽이의 바위 그늘과 가죽 천막 (시안 Main의 인트로 장면) */
export function BgCampTents({ uid }: LayerProps) {
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#121216'], [0.55, '#1f1c1d'], [1, '#3a2a1c']]} />
      <path d="M-40 250 L90 190 L170 214 L280 160 L380 210 L470 182 L580 228 L680 172 L790 218 L890 180 L1010 220 L1240 196 L1240 440 L-40 440 Z" fill="#1b1a1d" />
      <path className={s.lnBone} d="M90 190 L170 214 L280 160 L380 210 M680 172 L790 218 L890 180" />
      <path d="M-40 300 Q160 262 340 288 T700 278 T1060 292 T1240 282 L1240 440 L-40 440 Z" fill="#141210" />
      <path d="M0 382 C180 350 340 372 480 350 C620 328 700 360 840 350 C980 340 1080 360 1200 346 L1200 372 C1080 386 980 366 840 378 C700 390 620 356 480 378 C340 398 180 378 0 410 Z" fill="#23272b" />
      <path className={s.lnBone} d="M30 388 C190 358 340 378 480 357 M610 345 C700 364 780 356 840 356" />
      {/* 바위 그늘 */}
      <path d="M640 250 C700 222 800 212 890 228 C950 238 1000 266 1020 306 L1020 340 L660 340 C676 306 660 276 640 250 Z" fill="#100e0c" />
      <path className={s.ln} d="M655 262 C710 236 800 228 885 242 C940 252 985 276 1005 306" />
      <Tent x={700} base={340} w={60} h={58} />
      <Tent x={780} base={342} w={66} h={64} />
      <Tent x={858} base={340} w={56} h={52} />
      <Tent x={922} base={343} w={60} h={56} />
      <Tent x={740} base={346} w={40} h={38} />
      <path d="M0 440 L0 414 C220 404 420 420 640 410 C860 400 1000 414 1200 404 L1200 440 Z" fill="#0f0d0b" />
    </g>
  );
}

/** 북쪽 소나무 숲 */
export function BgNorthForest({ uid }: LayerProps) {
  const far = [60, 150, 230, 330, 420, 520, 610, 700, 790, 880, 980, 1070, 1160];
  const near = [20, 140, 270, 400, 760, 900, 1040, 1180];
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#1a1c1d'], [0.7, '#2b2a26'], [1, '#3a3127']]} />
      <path d="M0 260 C300 240 600 262 900 244 C1000 238 1100 248 1200 242 L1200 440 L0 440 Z" fill="#1a1c19" />
      {far.map((x, i) => (
        <Pine key={x} x={x} base={270} h={110 + (i % 3) * 18} fill="#1f241f" />
      ))}
      <path d="M0 330 C300 318 600 338 900 322 C1000 318 1100 326 1200 320 L1200 440 L0 440 Z" fill="#151613" />
      {near.map((x, i) => (
        <Pine key={x} x={x} base={360} h={170 + (i % 2) * 30} fill="#121410" />
      ))}
      <path className={s.ln} d="M140 360 L140 190 M760 360 L760 196" opacity="0.5" />
      <path d="M0 440 L0 400 C300 392 600 408 900 398 C1000 394 1100 402 1200 396 L1200 440 Z" fill="#0e0f0c" />
    </g>
  );
}

/** 바위굴 입구 */
export function BgCaveMouth({ uid }: LayerProps) {
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#1a1b1d'], [1, '#2e2a24']]} />
      {[80, 170, 1080, 1160].map((x, i) => (
        <Pine key={x} x={x} base={330} h={150 + (i % 2) * 30} fill="#151713" />
      ))}
      <path d="M300 440 L330 250 C380 150 520 100 640 110 C780 120 880 180 920 280 L950 440 Z" fill="#221c17" />
      <path className={s.ln} d="M330 250 C380 150 520 100 640 110 C780 120 880 180 920 280" />
      <path d="M500 440 C500 330 560 270 630 270 C700 270 760 330 760 440 Z" fill="#050404" />
      <path className={s.lnBone} d="M520 420 C530 330 580 290 630 290" />
      <path d="M0 440 L0 400 C300 392 600 410 900 400 C1000 396 1100 404 1200 398 L1200 440 Z" fill="#0f0d0b" />
    </g>
  );
}

/** 바위굴 안 */
export function BgCaveInside({ uid }: LayerProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.85" r="0.7">
          <stop offset="0" stopColor="#3a2716" />
          <stop offset="1" stopColor="#080605" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="440" fill={`url(#${uid}-glow)`} />
      <path d="M0 0 L1200 0 L1200 200 C1000 90 800 60 600 60 C400 60 200 90 0 200 Z" fill="#0a0807" />
      <path className={s.ln} d="M0 200 C200 90 400 60 600 60 C800 60 1000 90 1200 200" opacity="0.7" />
      <path className={s.lnBone} d="M180 150 l20 -10 l10 18 M960 140 l-24 -8 l-6 20" />
      <path d="M0 440 L0 390 C300 378 600 396 900 384 C1000 380 1100 388 1200 382 L1200 440 Z" fill="#120d0a" />
    </g>
  );
}

/** 남쪽 늪지 */
export function BgMarsh({ uid }: LayerProps) {
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#1c1c1e'], [1, '#2a2d2a']]} />
      <path d="M0 250 C200 240 400 256 600 244 C800 232 1000 250 1200 240 L1200 440 L0 440 Z" fill="#202724" />
      <path d="M80 330 C200 318 330 336 460 326 C520 322 560 330 540 340 C420 352 200 348 80 342 Z M700 360 C820 348 980 366 1100 356 C1140 352 1160 362 1130 368 C1000 378 820 376 700 370 Z" fill="#2c383b" />
      <path className={s.lnBone} d="M100 334 C220 324 340 340 460 330 M720 362 C840 352 980 368 1100 360" />
      <Reeds xs={[40, 56, 72, 300, 318, 620, 640, 900, 918, 1150, 1166]} base={400} tall={90} />
      <path d="M0 440 L0 404 C300 396 600 412 900 402 C1000 398 1100 406 1200 400 L1200 440 Z" fill="#141713" />
    </g>
  );
}

/** 갈대호수 */
export function BgReedLake({ uid }: LayerProps) {
  return (
    <g>
      <Sky uid={uid} id="sky" stops={[[0, '#1b2023'], [1, '#3a3a32']]} />
      <path d="M0 230 C300 220 600 236 900 226 C1000 222 1100 228 1200 224 L1200 270 L0 270 Z" fill="#232825" />
      <rect x="0" y="262" width="1200" height="120" fill="#2d3a40" />
      <path className={s.lnBone} d="M60 300 C260 290 460 306 660 296 M720 330 C860 322 1020 336 1160 328" />
      <Reeds xs={[30, 48, 66, 84, 1100, 1118, 1136, 1154]} base={420} tall={150} />
      <path d="M0 440 L0 380 C300 372 600 388 900 378 C1000 374 1100 382 1200 376 L1200 440 Z" fill="#161a17" />
    </g>
  );
}

// ── 대상 ──

/** 순록 떼 (천천히 이동) */
export function SubReindeerHerd() {
  return (
    <g className={s.herd}>
      {[
        [700, 238],
        [760, 244],
        [820, 236],
        [880, 246],
        [940, 240],
        [1000, 248],
        [1060, 238],
      ].map(([x, y]) => (
        <Grazer key={x} x={x!} y={y!} />
      ))}
    </g>
  );
}

/** 여울을 건너 달리는 순록 무리 */
export function SubReindeerRun() {
  return (
    <g className={s.run}>
      <g transform="translate(700 0)">
        {[
          [0, 300],
          [80, 292],
          [150, 304],
          [230, 296],
          [310, 306],
          [390, 298],
        ].map(([x, y]) => (
          <Runner key={x} x={x!} y={y!} />
        ))}
      </g>
    </g>
  );
}

/** 갈대 속 사냥꾼들 */
export function SubHunters() {
  return (
    <g className={s.bob}>
      <Hunter x={190} y={404} />
      <Hunter x={212} y={408} />
      <Hunter x={236} y={404} />
      <Hunter x={990} y={404} flip />
      <Hunter x={1012} y={408} flip />
    </g>
  );
}

export function SubGatherers() {
  return (
    <g>
      <Gatherer x={320} y={390} />
      <Gatherer x={400} y={396} />
      <Gatherer x={520} y={388} />
    </g>
  );
}

/** 모닥불: 불빛, 불꽃, 불티 (천막 앞) */
export function SubFireCircle({ uid }: LayerProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-fire`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f0a24a" stopOpacity="0.7" />
          <stop offset="0.45" stopColor="#b8612a" stopOpacity="0.25" />
          <stop offset="1" stopColor="#b8612a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className={s.fire} cx="810" cy="372" rx="170" ry="80" fill={`url(#${uid}-fire)`} />
      <g className={s.fire}>
        <path d="M798 386 C794 368 804 356 810 344 C816 356 826 368 822 386 Z" fill="#e0893a" />
        <path d="M804 386 C802 374 808 366 811 358 C814 366 819 374 817 386 Z" fill="#f6c46a" />
      </g>
      <path className={s.ln} d="M790 392 L834 384 M792 384 L832 394" />
      <circle className={s.ember} cx="810" cy="346" r="2" fill="#f6c46a" />
      <circle className={s.ember} style={delay(1.5)} cx="816" cy="350" r="1.5" fill="#f0a24a" />
      <circle className={s.ember} style={delay(3)} cx="804" cy="348" r="1.8" fill="#f6c46a" />
    </g>
  );
}

/** 멀리 보이는 마을: 천막 셋과 모닥불 (시안 TurnModal 왼쪽) */
export function SubCampFar({ uid }: LayerProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f0a24a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#b8612a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M144 360 C204 300 324 288 408 314 C456 328 492 360 504 396 L132 396 Z" fill="#14110e" />
      <Tent x={214} base={396} w={68} h={60} />
      <Tent x={302} base={400} w={76} h={70} />
      <Tent x={379} base={398} w={62} h={53} />
      <ellipse className={s.fire} cx="300" cy="408" rx="108" ry="60" fill={`url(#${uid}-glow)`} />
      <path className={s.fire} d="M293 415 C290 401 298 394 301 384 C305 394 312 401 310 415 Z" fill="#f0a24a" />
    </g>
  );
}

export function SubFirewood() {
  return (
    <g>
      <path className={s.ln} d="M880 404 h120 M888 394 h104 M896 384 h88 M904 374 h72" />
      <path className={s.lnBone} d="M884 404 v-4 M1000 404 v-4" />
      <Hunter x={1040} y={404} flip />
      <path className={s.ln} d="M1030 372 l40 -6" />
    </g>
  );
}

export function SubWolves() {
  return (
    <g className={s.herd}>
      <Wolf x={860} y={340} />
      <Wolf x={950} y={350} />
      <Wolf x={1040} y={336} />
    </g>
  );
}

/** 어둠 속 늑대 눈빛 */
export function SubWolfEyes() {
  const pairs = [
    [180, 300],
    [420, 330],
    [560, 290],
    [1010, 310],
    [1120, 340],
  ];
  return (
    <g>
      {pairs.map(([x, y], i) => (
        <g key={x} className={s.eyes} style={delay(i * 0.9)}>
          <circle cx={x} cy={y} r="3" fill="#f0b45a" />
          <circle cx={x! + 12} cy={y} r="3" fill="#f0b45a" />
        </g>
      ))}
    </g>
  );
}

export function SubStrangers() {
  return (
    <g>
      {[140, 186, 232, 278, 324, 370].map((x, i) => (
        <Stranger key={x} x={x} y={404 - (i % 2) * 6} />
      ))}
    </g>
  );
}

/** 소식을 들고 달려오는 사람 */
export function SubMessenger() {
  return (
    <g>
      <circle cx="560" cy="358" r="6" fill="#c9813a" />
      <path className={s.ln} d="M560 366 L552 392 M552 392 l-14 16 M552 392 l14 14 M558 372 l-16 6 M558 372 l14 -10" />
      <path className={s.lnBone} d="M520 404 h-30 M524 396 h-20" />
    </g>
  );
}

/** 앞쪽 갈대 (흔들림) */
export function SubReeds() {
  return <Reeds xs={[120, 140, 164, 1030, 1056, 1080]} base={440} tall={90} />;
}

// ── 날씨 덮개 ──

export function OvDusk({ uid }: LayerProps) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e08a40" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#e08a40" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="440" fill={`url(#${uid}-dusk)`} />
    </g>
  );
}

export function OvNight() {
  const stars = [
    [130, 50],
    [270, 100],
    [420, 40],
    [560, 90],
    [710, 34],
    [840, 76],
    [980, 48],
    [1110, 96],
    [200, 150],
    [1040, 150],
  ];
  return (
    <g>
      <rect x="0" y="0" width="1200" height="440" fill="#05070d" opacity="0.4" />
      {stars.map(([x, y], i) => (
        <circle key={x} className={s.star} style={delay((i * 0.7) % 3.2)} cx={x} cy={y} r={1 + (i % 3) * 0.4} fill="#e9dfcc" />
      ))}
      <circle cx="960" cy="110" r="30" fill="#d9cbb2" opacity="0.16" />
      <circle cx="960" cy="110" r="19" fill="#e9dfcc" opacity="0.45" />
    </g>
  );
}

export function OvSnow() {
  const flakes = Array.from({ length: 28 }, (_, i) => [(i * 173) % 1200, (i * 59) % 200]);
  return (
    <g>
      {flakes.map(([x, y], i) => (
        <circle key={i} className={s.fall} style={delay((i * 0.37) % 9)} cx={x} cy={y} r={1.4 + (i % 3) * 0.5} fill="#e9dfcc" opacity="0" />
      ))}
    </g>
  );
}

export function OvBlizzard() {
  const streaks = Array.from({ length: 34 }, (_, i) => [(i * 97) % 1400, (i * 41) % 440]);
  return (
    <g>
      <rect x="0" y="0" width="1200" height="440" fill="#d9cbb2" opacity="0.14" />
      <g className={s.streak}>
        {streaks.map(([x, y], i) => (
          <path key={i} d={`M${x} ${y} l-36 20`} stroke="#e9dfcc" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
        ))}
      </g>
    </g>
  );
}

export function OvFog() {
  return (
    <g className={s.drift}>
      <path d="M-100 220 C200 210 500 232 800 216 C1000 206 1200 220 1400 212" stroke="#cbbfa9" strokeOpacity="0.14" strokeWidth="36" fill="none" />
      <path d="M-100 300 C200 290 500 312 800 296 C1000 286 1200 300 1400 292" stroke="#cbbfa9" strokeOpacity="0.12" strokeWidth="44" fill="none" />
      <path d="M-100 370 C200 362 500 380 800 368 C1000 360 1200 372 1400 364" stroke="#cbbfa9" strokeOpacity="0.1" strokeWidth="30" fill="none" />
    </g>
  );
}

export function OvRain() {
  const drops = Array.from({ length: 40 }, (_, i) => [(i * 131) % 1240, (i * 67) % 400]);
  return (
    <g>
      <rect x="0" y="0" width="1200" height="440" fill="#0b0f14" opacity="0.25" />
      {drops.map(([x, y], i) => (
        <path key={i} className={s.rain} style={delay((i * 0.11) % 0.9)} d={`M${x} ${y} l-6 18`} stroke="#a9b8c9" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      ))}
    </g>
  );
}

// ── 초상 (viewBox 0 0 56 56) ──

export function makePortrait(color: string) {
  return function Portrait() {
    return (
      <g>
        <circle cx="28" cy="28" r="27" fill="#14110e" stroke={color} />
        <circle cx="28" cy="22" r="9" fill={color} opacity="0.85" />
        <path d="M12 48 C14 36 21 32 28 32 C35 32 42 36 44 48 Z" fill={color} opacity="0.85" />
      </g>
    );
  };
}

// ── 계절 지면 (배경 위, 대상 아래에 겹친다. 봄 시작 2026-11-20) ──

export function GroundSpring() {
  const tufts = Array.from({ length: 22 }, (_, i) => 20 + i * 55 + ((i * 37) % 23));
  return (
    <g opacity="0.85">
      <path d="M0 440 L0 412 C240 402 480 418 720 408 C960 398 1080 410 1200 404 L1200 440 Z" fill="#2c3322" opacity="0.55" />
      {tufts.map((x, i) => (
        <path key={x} className={s.reed} style={delay((i * 0.29) % 3)} d={`M${x} 424 l-4 -12 M${x} 424 l2 -14 M${x} 424 l7 -10`} stroke="#7d9a5a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      ))}
    </g>
  );
}

export function GroundSummer() {
  const tufts = Array.from({ length: 26 }, (_, i) => 10 + i * 47 + ((i * 29) % 19));
  return (
    <g opacity="0.8">
      <path d="M0 440 L0 406 C240 396 480 414 720 402 C960 392 1080 404 1200 398 L1200 440 Z" fill="#3a3a1e" opacity="0.5" />
      {tufts.map((x, i) => (
        <path key={x} className={s.reed} style={delay((i * 0.31) % 3)} d={`M${x} 426 q-3 -16 -8 -22 M${x} 426 q2 -18 4 -26 M${x} 426 q5 -12 12 -18`} stroke="#a3a05a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      ))}
    </g>
  );
}

export function GroundAutumn() {
  const leaves = Array.from({ length: 30 }, (_, i) => [(i * 41) % 1200, 412 + ((i * 13) % 24)]);
  return (
    <g opacity="0.8">
      <path d="M0 440 L0 410 C300 400 600 418 900 406 C1050 400 1120 408 1200 404 L1200 440 Z" fill="#3a2614" opacity="0.5" />
      {leaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4" ry="2" fill={i % 3 === 0 ? '#b8682e' : '#8a5a2c'} opacity="0.8" />
      ))}
    </g>
  );
}

export function GroundSnow() {
  return (
    <g>
      <path d="M0 440 L0 404 C200 394 420 412 640 400 C860 388 1040 404 1200 396 L1200 440 Z" fill="#cfc6b6" opacity="0.32" />
      <path className={s.lnBone} d="M0 404 C200 394 420 412 640 400 C860 388 1040 404 1200 396" />
    </g>
  );
}

// ── 봄·여름·가을의 대상 ──

/** 거슬러 오르는 물고기 떼 */
export function SubFishRun() {
  const fish: [number, number][] = Array.from({ length: 14 }, (_, i) => [140 + i * 70 + ((i * 23) % 30), 336 + ((i * 17) % 26)]);
  return (
    <g className={s.herd}>
      {fish.map(([x, y], i) => (
        <path key={i} className={s.lnBone} d={`M${x} ${y} q12 -6 24 0 q-12 6 -24 0 M${x + 24} ${y} l8 -5 M${x + 24} ${y} l8 5`} />
      ))}
    </g>
  );
}

/** 하늘을 지나는 철새 */
export function SubBirds() {
  const birds = Array.from({ length: 9 }, (_, i) => [600 + i * 46, 90 + ((i * 19) % 50)]);
  return (
    <g className={s.drift}>
      {birds.map(([x, y], i) => (
        <path key={i} className={s.lnThin} d={`M${x} ${y} q8 -8 16 0 q8 -8 16 0`} />
      ))}
    </g>
  );
}

/** 열매 덤불과 견과 */
export function SubBerries() {
  const bushes = [120, 260, 980, 1100];
  return (
    <g>
      {bushes.map((x, i) => (
        <g key={x}>
          <path d={`M${x - 40} 412 q40 -60 80 0 Z`} fill="#1f1d14" />
          {Array.from({ length: 7 }, (_, k) => (
            <circle key={k} cx={x - 26 + k * 9} cy={392 - ((k * 7 + i * 3) % 14)} r="3" fill="#b0432e" opacity="0.9" />
          ))}
        </g>
      ))}
    </g>
  );
}

/** 불어난 강물 */
export function SubFlood() {
  return (
    <g className={s.drift}>
      <path d="M0 360 C200 344 400 372 600 352 C800 332 1000 362 1200 346 L1200 440 L0 440 Z" fill="#3b4a52" opacity="0.55" />
      <path className={s.lnBone} d="M20 372 C220 356 420 384 620 364 M700 356 C860 340 1020 368 1180 352" />
    </g>
  );
}

/** 깨어 있는 곰 (실루엣) */
export function SubBear() {
  return (
    <g>
      <path d="M760 404 q0 -60 70 -66 q40 -4 70 18 q24 -10 34 6 q6 14 -12 18 q4 30 -6 44 h-20 v-20 h-70 v20 h-22 q-6 -10 -6 -20 Z" fill="#100d0a" />
      <path className={s.ln} d="M760 404 q0 -60 70 -66 q40 -4 70 18 q24 -10 34 6" />
      <circle cx="922" cy="350" r="2.6" fill="#e0a15a" />
    </g>
  );
}

/** 굴 안에 잠든 곰 */
export function SubBearSleeping() {
  return (
    <g>
      <path d="M520 410 q-10 -50 70 -56 q90 -6 110 40 q6 16 -10 16 Z" fill="#0d0b09" />
      <path className={s.ln} d="M520 410 q-10 -50 70 -56 q90 -6 110 40" opacity="0.7" />
      <path className={s.lnBone} d="M640 340 q10 -14 22 -8 M664 328 q10 -12 22 -6" />
    </g>
  );
}

/** 입구 바위의 발톱 자국 */
export function SubClawMarks() {
  return (
    <g>
      <path className={s.ln} d="M300 250 l30 70 M318 246 l30 72 M336 244 l28 70 M354 246 l24 66" strokeWidth="4" />
    </g>
  );
}

/** 고기와 물고기를 말리는 건조대 */
export function SubMeatRack() {
  return (
    <g>
      <path className={s.ln} d="M420 410 l20 -90 M560 410 l-20 -90 M432 330 h116 M436 352 h108" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} className={s.lnBone} d={`M${444 + i * 13} 330 v18 M${446 + i * 12} 352 v16`} />
      ))}
      <path className={s.lnBone} d="M470 410 q10 -20 0 -40 q-10 -20 6 -36" opacity="0.4" />
    </g>
  );
}

/** 얼음 구멍과 낚시꾼 */
export function SubIceHole() {
  return (
    <g>
      <ellipse cx="620" cy="388" rx="34" ry="9" fill="#0f1416" />
      <ellipse cx="620" cy="388" rx="34" ry="9" className={s.lnBone} />
      <path className={s.ln} d="M660 402 v-38 M660 364 l-30 18 M630 382 v8" />
      <circle cx="660" cy="356" r="6" fill="#c9813a" />
    </g>
  );
}

/** 붉은사슴 */
export function SubDeer() {
  return (
    <g className={s.herd}>
      {[820, 900, 990, 1080].map((x, i) => (
        <path
          key={x}
          className={s.lnThin}
          transform={`translate(${x} ${350 + (i % 2) * 10}) scale(1.4)`}
          d="M0 0 q20 -10 40 0 M8 0 l-2 18 M14 0 l2 18 M30 0 l-2 18 M36 0 l2 18 M0 -4 l-8 -16 M-8 -20 l-6 -10 l-6 4 M-8 -20 l2 -12 l6 -4 M-8 -20 l-12 2"
        />
      ))}
    </g>
  );
}

/** 불가에서 이야기하는 노인과 아이들 */
export function SubElderTelling() {
  return (
    <g>
      <path className={s.ln} d="M520 404 v-34 M520 370 l-14 16 M520 370 l14 10 M520 370 m-7 -14 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0" />
      <path className={s.lnThin} d="M470 404 v-18 m-5 -9 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M570 404 v-18 m-5 -9 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M600 404 v-16 m-4 -8 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" />
    </g>
  );
}

/** 널어 둔 가죽 */
export function SubHides() {
  return (
    <g>
      <path className={s.ln} d="M380 410 v-80 M520 410 v-80 M380 332 h140" />
      <path d="M392 336 q20 -4 40 0 l-4 50 q-16 6 -32 0 Z M450 336 q22 -4 46 0 l-6 54 q-18 6 -34 0 Z" fill="#6a4a2a" opacity="0.85" />
    </g>
  );
}
