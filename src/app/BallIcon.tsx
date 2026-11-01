import type { Character } from '../content/schema';
import { useId } from 'react';

export function BallIcon({ character, size = 40, image }: { character: Character; size?: number; image?: string }) {
  const tintId = useId().replaceAll(':', '');
  const tint = character.appearance.bodyTint;
  const channels = tint ? [1, 3, 5].map(i => parseInt(tint.slice(i, i + 2), 16) / 255) : [1, 1, 1];
  return <span className={`ball-icon ball-${character.appearance.style}${image ? ' has-art' : ''}`} style={{ '--ball-color': character.appearance.color, width: size, height: size } as React.CSSProperties} aria-hidden="true">
    {image ? <>{tint && tint !== '#ffffff' && <svg width="0" height="0" style={{ position: 'absolute' }}><defs><filter id={tintId}><feColorMatrix type="matrix" values={`${channels[0]} 0 0 0 0 0 ${channels[1]} 0 0 0 0 0 ${channels[2]} 0 0 0 0 0 1 0`} /></filter></defs></svg>}<img src={image} style={{ filter: tint && tint !== '#ffffff' ? `url(#${tintId})` : undefined }} alt="" /></> : <><span className="ball-inner" /><span className="ball-shine" />{character.appearance.style === 'core' && <span className="ball-dots">•••</span>}{character.appearance.style === 'prism' && <span className="ball-crystal" />}</>}
  </span>;
}
