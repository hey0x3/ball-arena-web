import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Fighter } from '../simulation/engine';
import { normalizeAngle, type LaunchAngles } from '../simulation/launch';
import { ARENA_CANVAS_SIZE, ARENA_SCALE, arenaPoint } from '../rendering/presentation';

export function ArenaLaunchArrows({ fighters, angles, onChange }: {
  fighters: Fighter[]; angles: LaunchAngles; onChange: (index: number, angle: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const aim = (event: PointerEvent<SVGGElement>, index: number) => {
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect(), origin = arenaPoint(fighters[index].body.getPosition());
    const x = (event.clientX - bounds.x) / bounds.width * ARENA_CANVAS_SIZE - origin.x;
    const y = origin.y - (event.clientY - bounds.y) / bounds.height * ARENA_CANVAS_SIZE;
    if (Math.hypot(x, y) > 10) onChange(index, normalizeAngle(Math.round(Math.atan2(y, x) * 180 / Math.PI)));
  };
  const key = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const step = event.shiftKey ? 15 : 5;
    const angle = event.key === 'Home' ? 0 : event.key === 'End' ? 359 : ['ArrowUp', 'ArrowRight'].includes(event.key) ? angles[index] + step : ['ArrowDown', 'ArrowLeft'].includes(event.key) ? angles[index] - step : undefined;
    if (angle === undefined) return;
    event.preventDefault(); onChange(index, normalizeAngle(angle));
  };
  return <svg className="arena-launch-arrows" viewBox={`0 0 ${ARENA_CANVAS_SIZE} ${ARENA_CANVAS_SIZE}`} data-dragging={dragging !== null} aria-label="Drag the arrow tips to choose starting directions">
    {fighters.map((fighter, index) => {
      const origin = arenaPoint(fighter.body.getPosition()), angle = angles[index] * Math.PI / 180, dx = Math.cos(angle), dy = -Math.sin(angle);
      const reach = (fighter.definition.stats.radius + .58) * ARENA_SCALE;
      const x = origin.x + dx * reach, y = origin.y + dy * reach;
      return <g key={fighter.id} role="slider" tabIndex={0} aria-label={`Contender ${index ? 'B' : 'A'} starting direction`}
        aria-valuemin={0} aria-valuemax={359} aria-valuenow={angles[index]} aria-valuetext={`${angles[index]} degrees`}
        style={{ '--arrow-color': fighter.definition.appearance.color } as React.CSSProperties}
        onKeyDown={event => key(event, index)}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(index); aim(event, index); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) aim(event, index); }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(null); }}
        onPointerCancel={() => setDragging(null)} onLostPointerCapture={() => setDragging(null)}>
        <title>Drag {fighter.definition.name}'s arrow to aim its launch</title>
        <line x1={origin.x} y1={origin.y} x2={x} y2={y} className="launch-arrow-hit-line" />
        <circle cx={x} cy={y} r={32} className="launch-arrow-hit-tip" />
        <circle cx={x} cy={y} r={20} className="launch-grip-halo" />
        <polygon points={`${x + dx * 9},${y + dy * 9} ${x - dx * 13 - dy * 10},${y - dy * 13 + dx * 10} ${x - dx * 13 + dy * 10},${y - dy * 13 - dx * 10}`} className="launch-grip" />
      </g>;
    })}
  </svg>;
}
