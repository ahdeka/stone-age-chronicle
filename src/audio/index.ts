// 사운드 인터페이스만 둔다 (CLAUDE.md: 사운드 구현은 나중에). UI는 이 포트로만 소리를 요청한다.

export type SoundCue = 'turnEnd' | 'choice' | 'gain' | 'loss' | 'seasonChange' | 'ending';

export interface AudioPort {
  play(cue: SoundCue): void;
  setVolume(v: number): void;
}

export const noopAudio: AudioPort = {
  play: () => {},
  setVolume: () => {},
};
