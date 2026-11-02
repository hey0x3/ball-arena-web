import { describe, expect, it } from 'vitest';
import { compactSkillStatus } from '../src/skills/compact-status';
import type { SkillStatus } from '../src/skills/status';

const status = (label: string, phase: SkillStatus['phase'], progress = .5): SkillStatus => ({ id: 'q', name: 'Test skill', label, phase, progress, detail: '', color: '#ffffff' });
describe('compact skill readouts', () => {
  it('keeps actual fractional cooldown and cast timers without confusing stage numbers', () => {
    expect(compactSkillStatus(status('3.2s to orb', 'cooldown')).value).toBe('3.2');
    expect(compactSkillStatus(status('Q3 WINDUP · 0.4s', 'charging')).value).toBe('0.4');
    expect(compactSkillStatus(status('WORLD ENDER · 4.6s', 'triggered')).value).toBe('4.6');
  });
  it('keeps charge requirements, shields and readiness meaningful without a clock', () => {
    expect(compactSkillStatus(status('2/3 WALL BOUNCES', 'charging'))).toMatchObject({ value: '2/3', caption: 'CHARGE' });
    expect(compactSkillStatus(status('SHIELD 17/25', 'ready'))).toMatchObject({ value: '17', caption: 'SHIELD' });
    expect(compactSkillStatus(status('READY · NEED CLOSE TARGET', 'ready'))).toMatchObject({ value: '✓', caption: 'WAIT' });
    expect(compactSkillStatus(status('ORB RETURNING', 'triggered')).caption).toBe('FLIGHT');
  });
  it('clamps the sweep and preserves recasts and interruption state', () => {
    expect(compactSkillStatus(status('1 DASHES LEFT · 0.2s', 'charging', -1))).toMatchObject({ value: '0.2', caption: 'RECAST', progress: 0 });
    expect(compactSkillStatus(status('CHANNEL INTERRUPTED', 'cooldown', 2))).toMatchObject({ caption: 'STOPPED', progress: 1 });
  });
});
