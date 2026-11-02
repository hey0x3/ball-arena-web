import { useState } from 'react';
import { Check, Plus, Upload, X, ArrowLeft } from 'lucide-react';
import { defaultSkill, parameterLabel, skillLabels, skillParameters, skillTypes, validateCharacter, type Character, type MediaFiles, type SavedCharacter, type Skill } from '../content/schema';
import { imageData } from '../content/packs';
import { BallIcon } from './BallIcon';

export function CharacterEditor({ original, media, onSave, onCancel }: { original: Character; media: MediaFiles; onSave: (entry: SavedCharacter) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(() => structuredClone(original));
  const [art, setArt] = useState<MediaFiles>(media);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const setStat = (key: keyof Character['stats'], value: number) => setDraft(c => ({ ...c, stats: { ...c.stats, [key]: value } }));
  const setSkill = (index: number, value: Partial<Skill>) => setDraft(c => ({ ...c, skills: c.skills.map((s, i) => i === index ? { ...s, ...value } : s) }));
  const save = async () => {
    setError(''); setBusy(true);
    try { await onSave({ character: validateCharacter(draft), media: art }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save character.'); }
    finally { setBusy(false); }
  };
  return <form className="character-editor" onSubmit={e => { e.preventDefault(); void save(); }}>
    <button className="back-button" type="button" onClick={onCancel}><ArrowLeft size={14} /> Back to roster</button>
    <div className="editor-preview"><BallIcon character={draft} size={76} image={draft.appearance.body ? art[draft.appearance.body] : undefined} /><div><span className="eyebrow">YOUR CREATION</span><h2>{draft.name || 'Untitled ball'}</h2><span className="muted">Make a little trouble.</span></div></div>
    <label className="field">Name<input required maxLength={32} value={draft.name} onChange={e => setDraft(c => ({ ...c, name: e.target.value }))} /></label>
    <label className="field">Character origin<input aria-label="Character origin" aria-describedby="character-origin-help" maxLength={60} list="character-origin-options" placeholder="Original creations" value={draft.origin ?? ''} onChange={e => setDraft(c => ({ ...c, origin: e.target.value || undefined }))} /><small id="character-origin-help">Game or universe, such as League of Legends or Dota 2. New origins become roster categories.</small></label>
    <datalist id="character-origin-options"><option value="Ball Arena" /><option value="League of Legends" /><option value="Dota 2" /><option value="Original creations" /></datalist>
    <label className="field">Character ID<input required value={draft.id} onChange={e => setDraft(c => ({ ...c, id: e.target.value }))} placeholder="community:my-ball" /><small>Namespaced, lowercase. Example: community:my-ball</small></label>
    <label className="field">Description<textarea maxLength={300} rows={2} value={draft.description} onChange={e => setDraft(c => ({ ...c, description: e.target.value }))} /></label>
    <div className="field-row"><label className="field">Color<div className="color-field"><input aria-label="Ball color" type="color" value={draft.appearance.color} onChange={e => setDraft(c => ({ ...c, appearance: { ...c.appearance, color: e.target.value } }))} /><span>{draft.appearance.color}</span></div></label><label className="field">Body style<select value={draft.appearance.style} onChange={e => setDraft(c => ({ ...c, appearance: { ...c.appearance, style: e.target.value as Character['appearance']['style'] } }))}>{['core', 'blade', 'dart', 'shield', 'magnet', 'flame', 'prism', 'meteor', 'mallet'].map(s => <option key={s}>{s}</option>)}</select></label></div>
    <label className="upload-art"><Upload size={15} /> {draft.appearance.body ? 'Replace artwork' : 'Add PNG / WebP artwork'}<input type="file" accept="image/png,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const data = await imageData(file); const path = `assets/body.${file.type === 'image/webp' ? 'webp' : 'png'}`; setArt(current => ({ ...current, [path]: data })); setDraft(c => ({ ...c, appearance: { ...c.appearance, body: path } })); setError(''); } catch (err) { setError(String(err)); } e.target.value = ''; }} /></label>
    {draft.appearance.body && <button className="text-button" type="button" onClick={() => { setDraft(c => ({ ...c, appearance: { ...c.appearance, body: undefined } })); }}>Remove artwork</button>}
    <div className="section-label"><span>BASE STATS</span><span>World units</span></div>
    <div className="stats-grid">
      {([
        ['maxHp', 'Health', 1, 2000, 1], ['contactDamage', 'Contact damage', 0, 200, 1],
        ['cruiseSpeed', 'Travel speed', .5, 12, .1], ['maxSpeed', 'Speed cap', 1, 20, .1],
        ['mass', 'Mass', .1, 10, .05], ['radius', 'Radius', .15, .65, .01], ['contactInterval', 'Hit interval (s)', .1, 10, .1],
      ] as const).map(([key, title, min, max, step]) => <label className="field" key={key}>{title}<input type="number" min={min} max={max} step={step} required value={draft.stats[key]} onChange={e => setStat(key, Number(e.target.value))} /></label>)}
    </div>
    <div className="section-label"><span>SKILLS</span><span>{draft.skills.length} / 3 slots</span></div>
    {draft.skills.map((skill, index) => <div className="skill-editor" key={index}>
      <div className="skill-editor-head"><span className="skill-index">0{index + 1}</span><select aria-label={`Skill ${index + 1} type`} value={skill.type} onChange={e => { const next = defaultSkill(e.target.value as Skill['type']); setSkill(index, { ...next, icon: undefined, id: `skill-${index + 1}` }); }}>{skillTypes.map(type => <option key={type} value={type}>{skillLabels[type]}</option>)}</select><button className="icon-button" aria-label={`Remove skill ${index + 1}`} type="button" onClick={() => setDraft(c => ({ ...c, skills: c.skills.filter((_, i) => i !== index) }))}><X size={15} /></button></div>
      <label className="field">Skill name<input required maxLength={40} value={skill.name} onChange={e => setSkill(index, { name: e.target.value })} /></label>
      <label className="upload-art"><Upload size={14} />{skill.icon ? 'Replace skill icon' : 'Add skill icon'}<input aria-label={`Skill ${index + 1} icon`} type="file" accept="image/png,image/webp" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        try { const data = await imageData(file), path = `assets/skill-${index + 1}.${file.type === 'image/webp' ? 'webp' : 'png'}`; setArt(current => ({ ...current, [path]: data })); setSkill(index, { icon: path }); setError(''); }
        catch (err) { setError(String(err)); } e.target.value = '';
      }} /></label>
      {skill.icon && <button className="text-button" type="button" onClick={() => setSkill(index, { icon: undefined })}>Use default skill symbol</button>}
      <div className="stats-grid">{skillParameters[skill.type].map(key => {
        const integer = ['maxCharges', 'reflections', 'poolSize', 'powerDamage'].includes(key);
        const maximum: Record<string, number> = { damage: 200, selfDamage: 200, tickInterval: 2, powerDamage: 200, returnDamage: 200, heal: 200, cooldown: 30, duration: 10, windup: 5, maxCharges: 5, impulseCap: 30, minimumImpact: 10, damagePerImpulse: 50, rotationSpeed: 720, reflections: 4, emitInterval: 2, poolSize: 64, slow: .9, healRatio: 1, damageMultiplier: 3, speedMultiplier: 2, healMultiplier: 3, sweetSpotMultiplier: 3, controlDuration: 2, recastInterval: 3, zoneRadius: 3, slowDuration: 5, rewindSeconds: 4 };
        const minimum = ['sweetSpotMultiplier', 'damageMultiplier', 'speedMultiplier', 'healMultiplier', 'rewindSeconds'].includes(key) ? 1 : ['damage', 'selfDamage', 'power', 'powerDamage', 'returnDamage', 'heal', 'slow', 'healRatio', 'controlDuration', 'windup', 'impulseCap', 'minimumImpact', 'damagePerImpulse', 'rotationSpeed', 'reflections'].includes(key) ? 0 : key === 'maxCharges' || key === 'poolSize' ? 1 : key === 'emitInterval' ? .02 : key === 'zoneRadius' ? .2 : .1;
        const value = skill[key] ?? (key === 'damagePerImpulse' ? skill.power > 0 ? skill.damage / skill.power : 0 : defaultSkill(skill.type)[key] ?? 0);
        return <label key={key} className="field">{parameterLabel(skill.type, key)}<input required type="number" min={minimum} max={maximum[key] ?? 20} step={integer ? 1 : .01} value={value} onChange={e => setSkill(index, { [key]: Number(e.target.value) })} /></label>;
      })}</div>
    </div>)}
    <button className="add-skill" type="button" disabled={draft.skills.length >= 3} onClick={() => setDraft(c => ({ ...c, skills: [...c.skills, { ...defaultSkill('projectile'), id: `skill-${crypto.randomUUID().slice(0, 8)}` }] }))}><Plus size={15} /> {draft.skills.length >= 3 ? 'All three skill slots filled' : 'Add a skill'}</button>
    <div className="section-label"><span>CREDITS</span></div>
    <label className="field">Creator<input required maxLength={80} value={draft.author} onChange={e => setDraft(c => ({ ...c, author: e.target.value }))} /></label>
    <div className="field-row"><label className="field">Asset license<input required maxLength={100} value={draft.assets.license} onChange={e => setDraft(c => ({ ...c, assets: { ...c.assets, license: e.target.value } }))} /></label><label className="field">Version<input required value={draft.version} onChange={e => setDraft(c => ({ ...c, version: e.target.value }))} /></label></div>
    <label className="field">Artwork source<input required maxLength={300} value={draft.assets.source} onChange={e => setDraft(c => ({ ...c, assets: { ...c.assets, source: e.target.value } }))} /></label>
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="editor-actions"><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit" disabled={busy}><Check size={16} />{busy ? 'Saving…' : 'Save & use ball'}</button></div>
  </form>;
}
