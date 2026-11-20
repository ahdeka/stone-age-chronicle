// 장면 합성: 배경 → 대상 → 날씨 덮개를 한 SVG 안에 겹친다 (DESIGN.md §11)
// 매니페스트 항목이 SVG 컴포넌트면 그대로, 이미지 파일이면 <image>로 같은 자리에 그린다.

import { useId } from 'react';
import type { SceneSpec } from '../../engine';
import { manifest } from '../../assets/manifest';
import s from '../../assets/scenes/scene.module.css';

interface Props {
  scene: SceneSpec;
  className?: string;
  /** 화면을 채울 때 어느 쪽을 남길지 (인트로는 오른쪽 아래의 마을을 남긴다) */
  align?: 'xMidYMid' | 'xMaxYMax' | 'xMidYMax';
}

export function Layer({ id, uid }: { id: string; uid: string }) {
  const a = manifest[id];
  if (!a) return null;
  if ('svg' in a) {
    const C = a.svg;
    return <C uid={uid} />;
  }
  return <image href={a.image} x="0" y="0" width="1200" height="440" preserveAspectRatio="xMidYMid slice" />;
}

export function SceneView({ scene, className, align = 'xMidYMid' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const layers = [scene.bg, ...(scene.subjects ?? []), ...(scene.overlay ? [scene.overlay] : [])];
  return (
    <svg className={`${s.svg} ${className ?? ''}`} viewBox="0 0 1200 440" preserveAspectRatio={`${align} slice`} aria-hidden="true" focusable="false">
      {layers.map((id, i) => (
        <Layer key={`${id}-${i}`} id={id} uid={`${uid}-${i}`} />
      ))}
    </svg>
  );
}

/** 조언자 초상 (자리별 색). 다치거나 아프면 작은 표시를 단다 */
export function Portrait({ seat, size = 44, ailing = false, label }: { seat?: string; size?: number; ailing?: boolean; label: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = `portrait.${seat ?? 'chief'}`;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={label} style={{ flex: 'none' }}>
      <Layer id={manifest[id] ? id : 'portrait.chief'} uid={uid} />
      {ailing && <path d="M40 40 h12 M46 34 v12" stroke="#f2a283" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}
