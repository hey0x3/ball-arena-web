import type { SkillStatus } from './status';

/** Both HUDs display the same simulation-time phase, timer or requirement. */
export function compactSkillStatus(status: SkillStatus) {
  const time = status.label.match(/(\d+(?:\.\d+)?)s\b/), charges = status.label.match(/(\d+)\/(\d+)/), shield = status.label.match(/^SHIELD (\d+)/);
  const remaining = time ? Number(time[1]) : null;
  const value = remaining === null ? '' : remaining >= 10 ? String(Math.ceil(remaining)) : remaining.toFixed(1);
  let caption = status.phase === 'cooldown' ? 'COOLDOWN' : status.phase === 'charging' ? 'CAST' : status.phase === 'triggered' ? 'ACTIVE' : 'READY';
  if (/WAITING|NEED CLOSE|OUT OF RANGE/.test(status.label)) caption = 'WAIT';
  if (/WALL BOUNCES/.test(status.label)) caption = 'CHARGE';
  if (/DASHES LEFT|NEXT SWING/.test(status.label)) caption = 'RECAST';
  if (/OUTBOUND|RETURNING|FLYING|IN FLIGHT/.test(status.label)) caption = 'FLIGHT';
  if (shield) caption = 'SHIELD';
  if (/INTERRUPTED/.test(status.label)) caption = 'STOPPED';
  return { value: shield?.[1] ?? (charges ? charges[0] : value || (status.phase === 'triggered' ? '•' : status.phase === 'ready' ? '✓' : '')), caption, progress: Math.max(0, Math.min(1, status.progress)) };
}
