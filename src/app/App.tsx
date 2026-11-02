import { useEffect, useRef, useState } from 'react';
import { CircleDot, Plus, Search, SlidersHorizontal, Play, Pause, RotateCcw, Video, Download, Upload, Moon, Sun, Volume2, VolumeX, Shuffle, Square, ArrowUpRight, X, Check, Copy, ChevronRight } from 'lucide-react';
import { builtinMedia, catalog } from '../content/catalog';
import { defaultSkill, type Character, type SavedCharacter } from '../content/schema';
import { characterOrigin, characterOrigins, ORIGINAL_ORIGIN } from '../content/origins';
import { downloadBlob, exportPack, imageData, importPack } from '../content/packs';
import { loadCharacters, saveCharacter } from '../storage/characters';
import { Simulation, STEP } from '../simulation/engine';
import { ArenaView } from '../rendering/arena';
import { ArenaAudio } from '../rendering/audio';
import { ArenaRecorder, RECORDING_STEP } from '../recording/recorder';
import { PortraitRecording } from '../recording/portrait';
import { BallIcon } from './BallIcon';
import { CharacterEditor } from './CharacterEditor';
import { ContenderHealth } from './ContenderHealth';
import { fighterSkillStatuses } from '../skills/status';
import { ArenaLaunchArrows } from './ArenaLaunchArrows';
import { DEFAULT_LAUNCH_ANGLES, isLaunchAngles, type LaunchAngles } from '../simulation/launch';

const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const roleNames = { core: 'STRIKER', blade: 'STRIKER', dart: 'RANGED', shield: 'DEFENDER', magnet: 'CONTROLLER', flame: 'CONTROLLER', prism: 'RANGED', meteor: 'STRIKER', mallet: 'RANGED' };
type Settings = { seed: string; shrink: boolean; timeout: number; theme: 'light' | 'dark'; speed: number; launchAngles: LaunchAngles; showCharacterHealth: boolean; recordingFormat: 'square' | 'portrait' };
const initialSettings: Settings = { seed: 'ricochet-001', shrink: true, timeout: 180, theme: 'dark', speed: 1, launchAngles: [...DEFAULT_LAUNCH_ANGLES], showCharacterHealth: true, recordingFormat: 'square' };
function storedSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem('ball-arena-settings') || '{}');
    const launchAngles: LaunchAngles = isLaunchAngles(value.launchAngles) ? [value.launchAngles[0], value.launchAngles[1]] : [...DEFAULT_LAUNCH_ANGLES];
    return { seed: typeof value.seed === 'string' ? value.seed.slice(0, 64) : initialSettings.seed, shrink: typeof value.shrink === 'boolean' ? value.shrink : true, timeout: [30, 60, 120, 180].includes(value.timeout) ? value.timeout : 180, theme: value.theme === 'light' ? 'light' : 'dark', speed: [.5, 1, 2, 4].includes(value.speed) ? value.speed : 1, launchAngles, showCharacterHealth: typeof value.showCharacterHealth === 'boolean' ? value.showCharacterHealth : true, recordingFormat: value.recordingFormat === 'portrait' ? 'portrait' : 'square' };
  } catch { return initialSettings; }
}
function snapshot(sim: Simulation) {
  return { phase: sim.phase, elapsed: sim.elapsed, hits: sim.totalHits, result: sim.result, hp: sim.fighters.map(f => f.hp), shields: sim.fighters.map(f => f.shield), skills: sim.fighters.map(f => fighterSkillStatuses(sim, f)) };
}

export default function App() {
  const [settings, setSettings] = useState(storedSettings); const settingsRef = useRef(settings); settingsRef.current = settings;
  const [custom, setCustom] = useState<SavedCharacter[]>([]); const customRef = useRef(custom); customRef.current = custom;
  const [selected, setSelected] = useState<Character[]>([catalog[0], catalog[1]]); const selectedRef = useRef(selected); selectedRef.current = selected;
  const [slot, setSlot] = useState(0); const [query, setQuery] = useState(''); const [tab, setTab] = useState<'all' | 'custom'>('all');
  const [origin, setOrigin] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedCharacter | null>(null); const [notice, setNotice] = useState('');
  const [error, setError] = useState(''); const [ready, setReady] = useState(false); const [sound, setSound] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false); const [pendingImport, setPendingImport] = useState<SavedCharacter | null>(null);
  const [recordTick, setRecordTick] = useState(0);
  const [recordArmed, setRecordArmed] = useState(false); const [startingRecord, setStartingRecord] = useState(false);
  const simRef = useRef<Simulation | null>(null); const viewRef = useRef<ArenaView | null>(null);
  const audioRef = useRef<ArenaAudio | null>(null); const recorderRef = useRef<ArenaRecorder | null>(null);
  const portraitRef = useRef<PortraitRecording | null>(null);
  const hostRef = useRef<HTMLDivElement>(null); const importRef = useRef<HTMLInputElement>(null);
  const clock = useRef({ accumulator: 0, finished: 0 });
  const [state, setState] = useState(() => snapshot(new Simulation(selected, settings)));
  const recording = recorderRef.current?.status === 'recording';
  const recordBusy = startingRecord || recording || recorderRef.current?.status === 'finalizing';
  const roster = tab === 'custom' ? custom.map(c => c.character) : [...catalog, ...custom.map(c => c.character)];
  const origins = characterOrigins(roster);
  const activeOrigin = origins.some(item => item.name === origin) ? origin : null;
  const all = roster.filter(c => (!activeOrigin || characterOrigin(c) === activeOrigin) && `${c.name} ${c.description} ${characterOrigin(c)}`.toLowerCase().includes(query.toLowerCase()));
  const getEntry = (character: Character): SavedCharacter => customRef.current.find(c => c.character.id === character.id) || { character, media: builtinMedia[character.id] || {} };
  const updateMedia = () => {
    const media: Record<string, string> = {};
    Object.entries(builtinMedia).forEach(([id, assets]) => Object.entries(assets).forEach(([path, data]) => media[`${id}/${path}`] = data));
    customRef.current.forEach(entry => Object.entries(entry.media).forEach(([path, data]) => media[`${entry.character.id}/${path}`] = data));
    return viewRef.current?.setMedia(media);
  };
  const reset = (characters = selectedRef.current) => {
    const sim = new Simulation(characters, settingsRef.current);
    simRef.current = sim; clock.current = { accumulator: 0, finished: 0 }; setState(snapshot(sim));
    return sim;
  };

  useEffect(() => {
    let alive = true, raf = 0, last = performance.now(), lastUi = 0, lastHits = 0, nextRecordAt = 0;
    const view = new ArenaView(); viewRef.current = view;
    const audio = new ArenaAudio(); audioRef.current = audio;
    const recorder = new ArenaRecorder(() => {
      if (recorder.status === 'ready' || recorder.status === 'failed') portraitRef.current = null;
      if (alive) setRecordTick(t => t + 1);
    }); recorderRef.current = recorder;
    simRef.current = new Simulation(selectedRef.current, settingsRef.current);
    void loadCharacters().then(entries => { if (alive) { customRef.current = entries; setCustom(entries); updateMedia(); } }).catch(e => { if (alive) setNotice(e.message); });
    void view.init(hostRef.current!).then(async () => {
      if (!alive) return; await updateMedia(); if (!alive) return; setReady(true); last = performance.now();
      const frame = async (now: number) => {
        if (!alive) return;
        const recordingFrame = recorder.status === 'recording';
        if (recordingFrame && now + .5 < nextRecordAt) { raf = requestAnimationFrame(frame); return; }
        nextRecordAt = recordingFrame ? Math.max(nextRecordAt + RECORDING_STEP * 1000, now) : now;
        const delta = recordingFrame ? RECORDING_STEP : Math.min(.1, (now - last) / 1000); last = now;
        const sim = simRef.current!;
        if (sim.phase === 'running') {
          clock.current.accumulator += delta * settingsRef.current.speed;
          let steps = 0;
          while (clock.current.accumulator >= STEP && steps++ < 24 && sim.phase === 'running') {
            const hits = sim.totalHits; sim.step(); clock.current.accumulator -= STEP;
            if (recordingFrame && sim.totalHits > hits) recorder.hit(Math.max(0, sim.elapsed - STEP));
          }
        } else clock.current.accumulator = 0;
        if (sim.totalHits !== lastHits) { if (sim.totalHits > lastHits) audio.hit(); lastHits = sim.totalHits; }
        view.render(sim, settingsRef.current.theme, sim.phase === 'running' ? clock.current.accumulator / STEP : 1, settingsRef.current.showCharacterHealth);
        portraitRef.current?.draw(view.canvas, sim, settingsRef.current.theme, f => view.artwork(f.definition), (f, skill) => view.skillArtwork(f.definition, skill));
        if (recordingFrame) { await recorder.captureFrame(); last = performance.now(); if (!alive) return; }
        if (sim.phase === 'finished') {
          clock.current.finished += delta;
          if (clock.current.finished >= 1.2 && recorder.status === 'recording') recorder.stop();
        }
        if (now - lastUi > 100) { setState(snapshot(simRef.current!)); lastUi = now; }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }).catch(e => { if (alive) setError(`The arena could not start: ${e.message}. A browser with WebGL support is required.`); });
    const hidden = () => {
      if (document.hidden) {
        simRef.current?.pause(); clock.current.accumulator = 0;
        if (recorder.status === 'recording' || recorder.status === 'preparing') recorder.stop('Interrupted: tab hidden');
        if (simRef.current) setState(snapshot(simRef.current));
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => { alive = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hidden); recorder.dispose(); portraitRef.current = null; audio.dispose(); view.dispose(); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    try { localStorage.setItem('ball-arena-settings', JSON.stringify(settings)); } catch { /* Simulation still works without settings persistence. */ }
  }, [settings]);
  useEffect(() => {
    const wrap = hostRef.current?.closest('.arena-wrap') as HTMLElement | null;
    const area = wrap?.parentElement;
    if (!wrap || !area) return;
    const fit = () => {
      const padding = getComputedStyle(area);
      const overhead = [...wrap.children].filter(child => child !== hostRef.current).reduce((sum, child) => {
        const style = getComputedStyle(child);
        return sum + child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
      }, 0);
      const width = area.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
      const height = area.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom) - overhead;
      const side = Math.floor(Math.max(200, Math.min(width, height))) + 'px';
      if (wrap.style.getPropertyValue('--arena-side') !== side) wrap.style.setProperty('--arena-side', side);
    };
    let fitFrame = 0;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(fitFrame); fitFrame = requestAnimationFrame(fit); }); observer.observe(area);
    for (const child of wrap.children) if (child !== hostRef.current) observer.observe(child);
    fit(); return () => { observer.disconnect(); cancelAnimationFrame(fitFrame); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);

  const assign = (character: Character) => {
    if (recordBusy) return;
    const next = selectedRef.current.map((c, i) => i === slot ? character : c); selectedRef.current = next; setSelected(next); reset(next);
  };
  const edit = (create = false) => {
    if (recordBusy) return;
    const original = getEntry(selectedRef.current[slot]);
    const id = `community:${create ? 'new-ball' : original.character.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 6)}`;
    const entry = create ? { character: { ...structuredClone(catalog[0]), id, origin: ORIGINAL_ORIGIN, name: 'New Ball', author: 'You', description: 'A new contender enters the arena.', appearance: { color: '#65c9b5', style: 'core' as const }, skills: [defaultSkill('projectile')], assets: { license: 'MIT', source: 'Original custom procedural character.' } }, media: {} } : original.character.id.startsWith('core:') ? { character: { ...structuredClone(original.character), id, name: `${original.character.name} Custom`.slice(0, 32), author: 'You' }, media: { ...original.media } } : structuredClone(original);
    simRef.current?.pause();
    if (simRef.current) setState(snapshot(simRef.current)); setEditing(entry); setOptionsOpen(false);
  };
  const saveEntry = async (entry: SavedCharacter) => {
    if (entry.character.id.startsWith('core:')) throw new Error('Use your own namespace, such as community:my-ball.');
    const existing = customRef.current.find(c => c.character.id === entry.character.id);
    if (existing && editing?.character.id !== entry.character.id && !pendingImport) throw new Error('That ID already exists. Choose a new ID to keep both balls.');
    // Store copied built-in media as local data, independent of future asset URLs.
    entry = { ...entry, media: { ...entry.media } };
    for (const [path, data] of Object.entries(entry.media)) if (!data.startsWith('data:')) {
      const response = await fetch(data); if (!response.ok) throw new Error('Could not copy character artwork.');
      entry.media[path] = await imageData(await response.blob());
    }
    await saveCharacter(entry);
    const entries = [...customRef.current.filter(c => c.character.id !== entry.character.id), entry]; customRef.current = entries; setCustom(entries); await updateMedia();
    const next = selectedRef.current.map((c, i) => i === slot || c.id === entry.character.id ? entry.character : c);
    selectedRef.current = next; setSelected(next); setEditing(null); setPendingImport(null); reset(next); setNotice(`${entry.character.name} saved to your browser.`);
  };
  const run = async () => {
    if (!ready || recordBusy || editing) return;
    if (simRef.current?.phase === 'running') { simRef.current.pause(); setState(snapshot(simRef.current)); return; }
    if (!recordArmed) {
      const sim = simRef.current?.phase === 'finished' ? reset() : simRef.current!;
      sim.start(); setState(snapshot(sim)); return;
    }
    setError('');
    setStartingRecord(true);
    setOptionsOpen(false);
    try {
      if (!viewRef.current || !ready) throw new Error('The arena is still loading.');
      if (sound) await audioRef.current?.enable();
      settingsRef.current = { ...settingsRef.current, speed: 1 }; setSettings(settingsRef.current);
      const sim = reset(); viewRef.current.render(sim, settingsRef.current.theme, 1, settingsRef.current.showCharacterHealth);
      portraitRef.current = settingsRef.current.recordingFormat === 'portrait' ? new PortraitRecording() : null;
      portraitRef.current?.draw(viewRef.current.canvas, sim, settingsRef.current.theme, f => viewRef.current?.artwork(f.definition), (f, skill) => viewRef.current?.skillArtwork(f.definition, skill));
      await recorderRef.current!.start(portraitRef.current?.canvas ?? viewRef.current.canvas, settingsRef.current.seed, sound);
      setRecordArmed(false); sim.start(); setState(snapshot(sim));
    } catch (e) { portraitRef.current = null; setError(e instanceof Error ? e.message : 'Recording could not start.'); }
    finally { setStartingRecord(false); }
  };
  const randomize = () => {
    const seed = `arena-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    settingsRef.current = { ...settingsRef.current, seed }; setSettings(settingsRef.current); reset();
  };
  const settingsChanged = (change: Partial<Settings>, restart = false) => { settingsRef.current = { ...settingsRef.current, ...change }; setSettings(settingsRef.current); if (restart) reset(); };
  const directionChanged = (index: number, angle: number) => {
    const launchAngles: LaunchAngles = [...settingsRef.current.launchAngles]; launchAngles[index] = angle;
    settingsChanged({ launchAngles }, true);
  };
  const exportSelected = () => { void exportPack(getEntry(selected[slot])).catch(e => setError(String(e))); };
  const healthPanel = (index: number) => {
    const character = selected[index];
    return <ContenderHealth character={character} index={index} hp={state.hp[index] ?? character.stats.maxHp}
      skills={state.skills[index] || []} shield={state.shields[index] ?? 0} selected={slot === index} disabled={recordBusy}
      image={character.appearance.body ? getEntry(character).media[character.appearance.body] : undefined} media={getEntry(character).media} onSelect={() => setSlot(index)} />;
  };

  return <div className="workspace" data-record-tick={recordTick} data-record-frames={recorderRef.current?.frames ?? 0}>
    <header className="topbar">
      <div className="brand"><span className="brand-symbol"><i /><i /></span><span>ball arena<span className="brand-dot">.</span></span><span className="version-tag">LAB 01</span></div>
      <div className="topbar-right"><span className="topbar-note">A simulation playground</span><span className="topbar-divider" /><button className="icon-button" aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => settingsChanged({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>{settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    </header>
    <main className="main-stage">
      <div className="stage-header"><div><div className="eyebrow">THE PLAYGROUND</div><h1>The arena<span className="title-period">.</span></h1></div><div className={`simulation-status ${state.phase}`}><span />{state.phase === 'running' ? 'Simulation live' : state.phase === 'paused' ? 'Paused' : state.phase === 'finished' ? 'Round complete' : 'Ready to collide'}</div></div>
      <div className="arena-area"><div className="arena-wrap">
        {healthPanel(1)}
        <div className="arena-meta"><span>01 <span className="muted">/</span> CLASSIC ARENA</span><span>1 vs 1 <i /> {time(state.elapsed)}</span></div>
        <div className="arena-canvas" ref={hostRef}>{!ready && <div className="canvas-loading"><CircleDot size={28} /><span>Preparing the arena…</span></div>}{ready && state.phase === 'ready' && !recordBusy && !editing && simRef.current && <ArenaLaunchArrows fighters={simRef.current.fighters} angles={settings.launchAngles} onChange={directionChanged} />}</div>
        <div className="arena-submeta"><span><span className="small-dot" /> {state.phase === 'finished' ? state.result : state.phase === 'ready' ? 'DRAG ARROW TIPS · PRESS RUN' : 'AUTONOMOUS COMBAT'}</span><span>{state.hits} CONTACTS</span></div>
        {healthPanel(0)}
      </div></div>
      <footer className="stage-footer"><span><span className="open-mark">⌘</span> Made for curious minds.</span><span>SEED <span className="seed-label">{settings.seed}</span></span></footer>
    </main>
    <aside className="sidebar" aria-label="Character and simulation controls">
      <div className="sidebar-scroll">
      {editing ? <CharacterEditor key={editing.character.id} original={editing.character} media={editing.media} onSave={saveEntry} onCancel={() => setEditing(null)} /> : <>
        <div className="roster-tabs"><button className={tab === 'all' ? 'active' : ''} onClick={() => { setTab('all'); setOrigin(null); }}>All balls <span>{catalog.length + custom.length}</span></button><button className={tab === 'custom' ? 'active' : ''} onClick={() => { setTab('custom'); setOrigin(null); }}>My creations <span>{custom.length}</span></button></div>
        <label className="search-field"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find your next contender…" aria-label="Search characters" /><kbd>/</kbd></label>
        <div className="origin-filters" role="group" aria-label="Character origins"><button aria-pressed={!activeOrigin} onClick={() => setOrigin(null)}>All origins <span>{roster.length}</span></button>{origins.map(item => <button key={item.name} aria-pressed={activeOrigin === item.name} onClick={() => setOrigin(item.name)}>{item.name}<span>{item.count}</span></button>)}</div>
        <div className="roster">{all.map(character => <button key={character.id} className={`roster-card ${selected[slot].id === character.id ? 'active' : ''}`} style={{ '--character-color': character.appearance.color } as React.CSSProperties} disabled={recordBusy} onClick={() => assign(character)} title={character.description} aria-label={`Assign ${character.name} to ${slot ? 'B' : 'A'}`}>
          <div className="roster-art"><BallIcon character={character} size={42} image={character.appearance.body ? getEntry(character).media[character.appearance.body] : undefined} />{selected.some(c => c.id === character.id) && <span className="assigned-mark">{selected.map((c, i) => c.id === character.id ? (i ? 'B' : 'A') : '').join('')}</span>}</div><strong>{character.name}</strong><span>{roleNames[character.appearance.style]}</span>
        </button>)}</div>
        {!all.length && <div className="empty-state"><CircleDot size={26} /><p>{tab === 'custom' && !custom.length ? 'Your next creation starts here.' : 'No balls found. Try another name or origin.'}</p>{tab === 'custom' && !custom.length && <button className="text-button" onClick={() => edit(true)}>Create your first ball <Plus size={13} /></button>}</div>}
        <div className="selected-details"><div className="details-header"><span className="section-caption">CONTENDER {slot ? 'B' : 'A'}</span><button className="text-button" disabled={recordBusy} onClick={() => edit()}><SlidersHorizontal size={13} /> Customize</button></div><h3>{selected[slot].name}</h3><p>{selected[slot].description}</p><div className="quick-stats"><div><span>HEALTH</span><strong>{selected[slot].stats.maxHp}</strong></div><div><span>SPEED</span><strong>{selected[slot].stats.cruiseSpeed.toFixed(1)}</strong></div><div><span>SKILLS</span><strong>{selected[slot].skills.length}<small> / 3</small></strong></div></div><div className="skill-pills">{selected[slot].skills.map(skill => <span key={skill.id}><span className="small-dot" style={{ background: selected[slot].appearance.color }} />{skill.name}</span>)}</div></div>
        <div className="create-card"><span className="create-glyph"><Plus size={18} /></span><div><strong>A ball of your own.</strong><p>New look. New skills. Your rules.</p></div><button aria-label="Add custom character" disabled={recordBusy} onClick={() => edit(true)}><ArrowUpRight size={18} /></button></div>
        <div className="pack-actions"><button disabled={recordBusy} onClick={() => importRef.current?.click()}><Upload size={14} /> Import pack</button><button disabled={recordBusy} onClick={exportSelected}><Download size={14} /> Export ball</button></div>
      </>}
      </div>
      <div className="simulation-controls">
        {!editing && <section className="contender-setup" aria-label="Choose contenders"><div className="sidebar-heading"><div><span className="eyebrow">THE CONTENDERS</span><h2>Choose your chaos.</h2></div><button className="icon-button boxed" aria-label="Create a new ball" disabled={recordBusy} onClick={() => edit(true)}><Plus size={19} /></button></div>
          <div className="slot-selector">{selected.map((c, i) => <button key={i} className={slot === i ? 'active' : ''} aria-pressed={slot === i} onClick={() => setSlot(i)} disabled={recordBusy}><span className={`slot-marker ${i ? 'slot-b' : ''}`}>{i ? 'B' : 'A'}</span><span>{c.name}</span>{slot === i && <Check size={13} />}</button>)}</div>
        </section>}
        <div className="controls-heading"><span className="eyebrow">SIMULATION</span><div><button className={`icon-button ${sound ? 'on' : ''}`} aria-label={sound ? 'Mute arena' : 'Enable arena sound'} disabled={recordBusy} onClick={async () => { try { if (!sound) await audioRef.current?.enable(); else if (audioRef.current) audioRef.current.enabled = false; setSound(!sound); } catch (e) { setError(String(e)); } }}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button><button className={`icon-button ${optionsOpen ? 'on' : ''}`} aria-label="Simulation settings" aria-expanded={optionsOpen} disabled={recordBusy} onClick={() => setOptionsOpen(!optionsOpen)}><SlidersHorizontal size={16} /></button></div></div>
        {optionsOpen && <div className="simulation-options"><label className="check-field"><input type="checkbox" checked={settings.showCharacterHealth} onChange={e => settingsChanged({ showCharacterHealth: e.target.checked })} /><span>Show health on characters</span></label><label className="field">Seed<div className="seed-input"><input value={settings.seed} maxLength={64} onChange={e => settingsChanged({ seed: e.target.value })} onBlur={() => reset()} /><button className="icon-button" aria-label="Randomize seed" onClick={randomize}><Shuffle size={14} /></button></div></label><label className="field">Round time limit<select value={settings.timeout} onChange={e => settingsChanged({ timeout: Number(e.target.value) }, true)}>{[30, 60, 120, 180].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label><label className="check-field"><input type="checkbox" checked={settings.shrink} onChange={e => settingsChanged({ shrink: e.target.checked }, true)} /><span>Sudden death after 2 minutes</span></label><button className="text-button" onClick={() => downloadBlob(new Blob([JSON.stringify({ version: 1, engine: '0.3.0', settings, characters: selected }, null, 2)], { type: 'application/json' }), 'arena-setup.json')}><Copy size={13} /> Save setup snapshot</button></div>}
        <div className="playback-row"><button className="primary-button play-button" disabled={!ready || recordBusy || !!editing} onClick={() => void run()}>{state.phase === 'running' ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{state.phase === 'running' ? 'Pause' : 'Run'}</button><button className="icon-button restart-button" aria-label="Reset arena" title="Return to starting positions" disabled={!ready || recordBusy || !!editing} onClick={() => reset()}><RotateCcw size={17} /></button></div>
        <div className="speed-control"><span>Playback speed</span><div>{[.5, 1, 2, 4].map(speed => <button key={speed} className={settings.speed === speed ? 'active' : ''} disabled={recordBusy} onClick={() => settingsChanged({ speed })}>{speed}×</button>)}</div></div>
        <label className="record-format">Video format<select aria-label="Recording format" value={settings.recordingFormat} disabled={recordBusy || !!editing} onChange={e => settingsChanged({ recordingFormat: e.target.value as Settings['recordingFormat'] })}><option value="square">1:1 · Square</option><option value="portrait">9:16 · Short-form</option></select></label>
        {recording ? <button className="record-button recording" onClick={() => recorderRef.current?.stop('Stopped early')}><Square size={14} fill="currentColor" /><span>Stop recording</span><span>{time(recorderRef.current?.seconds || 0)}</span></button> : <button className={`record-button ${recordArmed ? 'armed' : ''}`} aria-label={recordBusy ? 'Finalizing recording' : recordArmed ? 'Cancel recording' : 'Record round'} aria-pressed={recordArmed} disabled={!ready || recordBusy || !!editing} onClick={() => { if (!recordArmed) reset(); setRecordArmed(!recordArmed); }}><Video size={17} /><span>{recordBusy ? 'Preparing video…' : recordArmed ? 'Cancel recording' : 'Record round'}</span><span className="record-quality" aria-hidden="true">{settings.recordingFormat === 'portrait' ? '9:16' : '1:1'}</span></button>}
        <div className="record-note">{recordArmed ? 'Ready to record MP4 · press Run' : recorderRef.current?.status === 'ready' ? <button className="text-button" onClick={() => recorderRef.current?.download()}><Download size={12} /> Download last recording{recorderRef.current.reason ? ` · ${recorderRef.current.reason}` : ''}</button> : recorderRef.current?.status === 'failed' ? <span role="alert">{recorderRef.current.reason}</span> : recording ? 'MP4 · 60 fps · auto-saves at round end' : settings.recordingFormat === 'portrait' ? 'MP4 · 720 × 1280 · arena + health panels' : 'MP4 · 720 × 720 · arena only'}</div>
      </div>
      <div className="sidebar-footer"><span className="small-dot" /><span>Open source. Open possibilities.</span><CircleDot size={13} /></div>
    </aside>
    <input hidden ref={importRef} type="file" accept=".zip,.json" aria-label="Import character pack" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const entry = await importPack(file); if (entry.character.id.startsWith('core:')) { entry.character.id = `community:${entry.character.id.split(':')[1]}-${crypto.randomUUID().slice(0, 6)}`; } if (customRef.current.some(c => c.character.id === entry.character.id)) setPendingImport(entry); else await saveEntry(entry); } catch (err) { setError(err instanceof Error ? err.message : 'Invalid character pack.'); } e.target.value = ''; }} />
    {notice && <div className="toast" role="status"><Check size={15} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}
    {error && <div className="error-toast" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
    {pendingImport && <div className="modal-backdrop"><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="eyebrow">CHARACTER IMPORT</div><h2 id="import-title">This ball already exists.</h2><p>Replace your saved {pendingImport.character.name}, or give this version a new identity and keep both.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setPendingImport(null)}>Cancel</button><button className="secondary-button" onClick={() => { const entry = { ...pendingImport, character: { ...pendingImport.character, id: `${pendingImport.character.id.slice(0, 85)}-${crypto.randomUUID().slice(0, 6)}` } }; void saveEntry(entry).catch(e => setError(e.message)); }}>Keep both</button><button className="primary-button" onClick={() => void saveEntry(pendingImport).catch(e => setError(e.message))}>Replace</button></div></section></div>}
  </div>;
}
