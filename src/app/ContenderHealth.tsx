import type { Character } from '../content/schema';
import { BallIcon } from './BallIcon';
import type { SkillStatus } from '../skills/status';

export function ContenderHealth({ character, index, hp, skills, shield, selected, disabled, image, onSelect }: {
  character: Character; index: number; hp: number; skills: SkillStatus[]; shield: number; selected: boolean;
  disabled: boolean; image?: string; onSelect: () => void;
}) {
  return <button className={`contender contender-${index ? 'above' : 'below'} ${selected ? 'selected' : ''}`} data-contender={index}
    style={{ '--character-color': character.appearance.color } as React.CSSProperties}
    disabled={disabled} onClick={onSelect} aria-label={`Select contender ${index ? 'B' : 'A'} for editing`}>
    <span className="contender-letter">{index ? 'B' : 'A'}</span>
    <BallIcon character={character} size={38} image={image} />
    <div className="contender-info">
      <div className="contender-name">{character.name}<span>{shield > 0 && <small className="shield-value">+{shield} shield · </small>}{Math.ceil(hp)} <small>HP</small></span></div>
      <div className="health-track" role="progressbar" aria-label={`Contender ${index ? 'B' : 'A'} health`} aria-valuemin={0} aria-valuemax={character.stats.maxHp} aria-valuenow={Math.ceil(hp)}>
        <i style={{ width: `${Math.max(0, hp / character.stats.maxHp * 100)}%` }} />
      </div>
      <div className="live-skills">{skills.map(skill => <div className={'live-skill phase-' + skill.phase} key={skill.id} data-skill={skill.id} style={{ '--skill-color': skill.color } as React.CSSProperties} title={skill.detail}>
        <div className="skill-live-heading"><strong>{skill.name}</strong><span>{skill.label}</span></div>
        <div className="skill-live-track" role="progressbar" aria-label={skill.name + ' readiness for ' + (index ? 'B' : 'A')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, skill.progress)) * 100)}><i style={{ width: Math.max(0, Math.min(1, skill.progress)) * 100 + '%' }} /></div>
        <span className="skill-live-detail">{skill.detail}</span>
      </div>)}</div>
      {!skills.length && <span className="contender-skills">Pure physics</span>}
    </div>
  </button>;
}
