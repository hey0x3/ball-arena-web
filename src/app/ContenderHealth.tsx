import { useId, useState } from 'react';
import type { Character, MediaFiles } from '../content/schema';
import { skillIconUrl } from '../content/skill-icons';
import { compactSkillStatus } from '../skills/compact-status';
import { BallIcon } from './BallIcon';
import type { SkillStatus } from '../skills/status';

export function ContenderHealth({ character, index, hp, skills, shield, selected, disabled, image, media, onSelect }: {
  character: Character; index: number; hp: number; skills: SkillStatus[]; shield: number; selected: boolean;
  disabled: boolean; image?: string; media?: MediaFiles; onSelect: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null), tooltipId = useId();
  return <section className={`contender contender-${index ? 'above' : 'below'} ${selected ? 'selected' : ''}`} data-contender={index}
    style={{ '--character-color': character.appearance.color } as React.CSSProperties} aria-label={`Contender ${index ? 'B' : 'A'}: ${character.name}`}>
    <button className="contender-select" disabled={disabled} onClick={onSelect} aria-label={`Select contender ${index ? 'B' : 'A'} for editing`} aria-pressed={selected}>
      <span className="contender-letter">{index ? 'B' : 'A'}</span>
      <BallIcon character={character} size={36} image={image} />
      <span className="contender-info">
        <span className="contender-name"><strong>{character.name}</strong><span>{Math.ceil(hp)} <small>HP</small></span></span>
        <span className="health-track" role="progressbar" aria-label={`Contender ${index ? 'B' : 'A'} health`} aria-valuemin={0} aria-valuemax={character.stats.maxHp} aria-valuenow={Math.ceil(hp)}>
          <i style={{ width: `${Math.max(0, hp / character.stats.maxHp * 100)}%` }} />
        </span>
        {shield > 0 && <small className="shield-value">+{shield} shield</small>}
        {!skills.length && <span className="contender-skills">Pure physics</span>}
      </span>
    </button>
    {!!skills.length && <div className="live-skills" role="group" aria-label={`Contender ${index ? 'B' : 'A'} skills`}>{skills.map((skill, slot) => {
      const definition = character.skills[slot], compact = compactSkillStatus(skill), tip = `${tooltipId}-${slot}`;
      const shortcut = /^[qwer]$/i.test(definition.id) ? definition.id.toUpperCase() : String(slot + 1);
      return <div className={'live-skill phase-' + skill.phase} key={skill.id} data-skill={skill.id} data-open={open === skill.id}
        style={{ '--skill-color': skill.color } as React.CSSProperties}
        onMouseEnter={() => setOpen(skill.id)} onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setOpen(null); }}>
        <button className="skill-tile" type="button" aria-label={`Inspect ${skill.name}`} aria-describedby={open === skill.id ? tip : undefined}
          onFocus={() => setOpen(skill.id)} onBlur={() => setOpen(null)} onClick={() => setOpen(skill.id)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(null); } }}>
          <img className="skill-art" src={skillIconUrl(definition, media)} alt="" />
          <span className="skill-cooldown-sweep" style={{ background: `conic-gradient(from 0deg, #080911bb ${(1 - compact.progress) * 360}deg, transparent 0deg)` }} />
          <span className="skill-countdown">{compact.value}</span><span className="skill-shortcut">{shortcut}</span><span className="skill-phase-dot" />
        </button>
        <div className="skill-live-track" role="progressbar" aria-label={skill.name + ' readiness for ' + (index ? 'B' : 'A')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(compact.progress * 100)}><i style={{ width: compact.progress * 100 + '%' }} /></div>
        <span className="skill-mini-label">{compact.caption}</span>
        <div className="skill-tooltip" id={tip} role="tooltip"><div className="skill-live-heading"><strong>{skill.name}</strong><span>{skill.label}</span></div><span className="skill-live-detail">{skill.detail}</span></div>
      </div>;
    })}</div>}
  </section>;
}
