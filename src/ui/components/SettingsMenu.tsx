// 설정: 속도, 움직임 줄이기, 결정 팝업 자동 열기, 글자 크기

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useMotion, type AutoDelay, type Speed } from '../motion';
import { Icon } from './bits';
import c from './chrome.module.css';

export function SettingsMenu() {
  const tr = useT();
  const { settings, set } = useMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={c.settingsWrap} ref={ref}>
      <button type="button" className={c.settingsBtn} aria-label={tr.t('ui.settings')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="settings" size={20} />
      </button>
      {open && (
        <div className={c.settings} role="dialog" aria-label={tr.t('ui.settings')}>
          <div className={c.settingsRow}>
            <span>{tr.t('ui.settings.speed')}</span>
            <div className={c.segment}>
              {(['slow', 'normal', 'fast'] as Speed[]).map((sp) => (
                <button key={sp} type="button" aria-pressed={settings.speed === sp} onClick={() => set({ speed: sp })}>
                  {tr.t(`speed.${sp}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={c.settingsRow}>
            <span>{tr.t('ui.settings.font')}</span>
            <div className={c.segment}>
              {([1, 2, 3] as const).map((f) => (
                <button key={f} type="button" aria-pressed={settings.fontScale === f} onClick={() => set({ fontScale: f })}>
                  {tr.t(`font.${f}`)}
                </button>
              ))}
            </div>
          </div>
          <label className={c.check}>
            <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} />
            {tr.t('ui.settings.reduceMotion')}
          </label>
          <label className={c.check}>
            <input type="checkbox" checked={settings.autoOpen} onChange={(e) => set({ autoOpen: e.target.checked })} />
            {tr.t('ui.settings.autoOpen')}
          </label>
          <label className={c.check}>
            <input type="checkbox" checked={settings.stepByStep} onChange={(e) => set({ stepByStep: e.target.checked })} />
            {tr.t('ui.settings.stepByStep')}
          </label>
          {!settings.stepByStep && (
            <div className={c.settingsRow}>
              <span>{tr.t('ui.settings.autoDelay')}</span>
              <div className={c.segment}>
                {(['short', 'normal', 'long'] as AutoDelay[]).map((d) => (
                  <button key={d} type="button" aria-pressed={settings.autoDelay === d} onClick={() => set({ autoDelay: d })}>
                    {tr.t(`delay.${d}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
