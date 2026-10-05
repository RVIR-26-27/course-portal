// Interactive learning module. Content stays plain Markdown (src/content/*.md)
// with two small extensions in fenced blocks:
//
//   ```check                      practice question (not graded, not stored)
//   ? Question with `code`
//   - [ ] wrong option
//   - [x] correct option          several [x] -> "select all that apply"
//   > Explanation shown after checking.
//   ```
//
//   ```reveal                     predict first, then reveal
//   What is printed?
//   ---
//   `A C B D` — because ...
//   ```
//
// Practice questions ship in the public bundle: never copy readiness-quiz
// questions here (docs/QUIZ_AUTHORING.md).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { marked, type Token, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import { Badge, Bar, CopyButton, Icon, InlineMd } from './ui';
import type { Resource } from '../content/resources';

const slugify = (x: string) => x.toLowerCase().replace(/[`*]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ------------------------------------------------------------------ code with light Dart highlighting
const DART = /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b(\d+(?:\.\d+)?)\b|\b(abstract|async|await|break|case|catch|class|const|continue|default|else|enum|extends|final|finally|for|if|implements|import|in|is|late|new|null|on|required|return|static|super|switch|this|throw|true|false|try|var|void|while|with|yield|get|set|Future|Stream|List|Map|String|int|double|bool|Object|dynamic|Widget|override)\b|(@\w+)/g;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  DART.lastIndex = 0;
  while ((m = DART.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'tok-com' : m[2] ? 'tok-str' : m[3] ? 'tok-num' : m[4] ? 'tok-kw' : 'tok-ann';
    out.push(<span key={i++} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function CodeBlock({ text, lang }: { text: string; lang: string }) {
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span className="tiny">{lang || 'text'}</span>
        <CopyButton text={text} />
      </div>
      <pre className="code" tabIndex={0}><code>{lang === 'dart' ? highlight(text) : text}</code></pre>
    </div>
  );
}

// ------------------------------------------------------------------ practice question
interface Check { question: string; options: { text: string; correct: boolean }[]; explanation: string }

function parseCheck(src: string): Check | null {
  const lines = src.split('\n');
  const q = lines.find((l) => l.startsWith('? '));
  const options = lines.filter((l) => /^- \[( |x)\] /.test(l)).map((l) => ({ text: l.slice(6), correct: l[3] === 'x' }));
  const explanation = lines.filter((l) => l.startsWith('> ')).map((l) => l.slice(2)).join(' ');
  if (!q || options.length < 2 || !options.some((o) => o.correct)) return null;
  return { question: q.slice(2), options, explanation };
}

const PRAISE = ['Nice!', 'Exactly.', 'Spot on!', 'Correct!', 'Well reasoned.'];

function PracticeCheck({ check, id }: { check: Check; id: string }) {
  const multi = check.options.filter((o) => o.correct).length > 1;
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<null | boolean>(null);
  const correct = check.options.every((o, i) => o.correct === picked.has(i));
  return (
    <div className={`practice${done === true ? ' right' : done === false ? ' wrong' : ''}`} role="group" aria-labelledby={`${id}-q`}>
      <div className="practice-head"><Badge tone="info" icon="sparkle">Try it</Badge><span className="tiny muted">practice · not graded</span></div>
      <p id={`${id}-q`} className="practice-q"><InlineMd text={check.question} /></p>
      {multi && <p className="tiny muted">Select all that apply.</p>}
      <div className="options">
        {check.options.map((o, i) => (
          <label key={i} className={`option${done !== null && o.correct ? ' correct' : ''}${done === false && picked.has(i) && !o.correct ? ' incorrect' : ''}`}>
            <input type={multi ? 'checkbox' : 'radio'} name={id} checked={picked.has(i)} onChange={() => {
              setDone(null);
              setPicked((p) => { const n = new Set(multi ? p : []); if (multi && n.has(i)) n.delete(i); else n.add(i); return n; });
            }} />
            <span><InlineMd text={o.text} /></span>
          </label>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn btn-small" disabled={picked.size === 0} onClick={() => setDone(correct)}>Check</button>
        {done !== null && (
          <span className={`practice-result pop ${done ? 'good' : 'bad'}`} role="status">
            {done ? <><Icon name="check" size={16} /> {PRAISE[check.question.length % PRAISE.length]}</> : <><Icon name="refresh" size={16} /> Not quite — look at the highlighted answer.</>}
          </span>
        )}
      </div>
      {done !== null && check.explanation && <p className="explain"><InlineMd text={check.explanation} /></p>}
    </div>
  );
}

// ------------------------------------------------------------------ predict-then-reveal
function Reveal({ src }: { src: string }) {
  const [prompt, answer] = src.split(/\n---\n/);
  const [open, setOpen] = useState(false);
  return (
    <div className="reveal">
      <div className="practice-head"><Badge tone="warn" icon="eye">Predict first</Badge></div>
      <div className="reveal-prompt" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(prompt ?? '', { async: false }) as string) }} />
      {open ? (
        <div className="reveal-answer pop" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(answer ?? '', { async: false }) as string) }} />
      ) : (
        <button type="button" className="btn btn-small" onClick={() => setOpen(true)} aria-expanded={false}>I have my answer — reveal</button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ module
interface Section { id: string; title: string; tokens: Token[] }

function splitSections(md: string): { intro: Token[]; sections: Section[] } {
  const tokens = marked.lexer(md);
  const intro: Token[] = [];
  const sections: Section[] = [];
  for (const t of tokens) {
    if (t.type === 'heading' && (t as Tokens.Heading).depth === 1) continue; // page title is rendered by the lab header
    if (t.type === 'heading' && (t as Tokens.Heading).depth === 2) {
      const title = (t as Tokens.Heading).text;
      sections.push({ id: `sec-${slugify(title)}`, title, tokens: [] });
    } else if (sections.length) sections[sections.length - 1]!.tokens.push(t);
    else intro.push(t);
  }
  return { intro, sections };
}

function Blocks({ tokens, keyPrefix }: { tokens: Token[]; keyPrefix: string }) {
  const parts: ReactNode[] = [];
  let buf: Token[] = [];
  const flush = (k: string) => {
    if (!buf.length) return;
    const html = DOMPurify.sanitize(marked.parser(buf as Tokens.Generic[] as never));
    parts.push(<div key={k} className="prose-part" dangerouslySetInnerHTML={{ __html: html }} />);
    buf = [];
  };
  tokens.forEach((t, i) => {
    if (t.type === 'code') {
      const c = t as Tokens.Code;
      flush(`${keyPrefix}-h${i}`);
      if (c.lang === 'check') {
        const check = parseCheck(c.text);
        parts.push(check ? <PracticeCheck key={`${keyPrefix}-c${i}`} check={check} id={`${keyPrefix}-c${i}`} /> : <CodeBlock key={i} text={c.text} lang="text" />);
      } else if (c.lang === 'reveal') parts.push(<Reveal key={`${keyPrefix}-r${i}`} src={c.text} />);
      else parts.push(<CodeBlock key={`${keyPrefix}-k${i}`} text={c.text} lang={c.lang ?? ''} />);
    } else buf.push(t);
  });
  flush(`${keyPrefix}-end`);
  return <>{parts}</>;
}

function loadDone(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as string[]; } catch { return []; }
}

export function LearnModule({ lab, markdown, resources, footer }: { lab: string; markdown: string; resources: Resource[]; footer: ReactNode }) {
  const { intro, sections } = useMemo(() => splitSections(markdown), [markdown]);
  const storeKey = `learn-progress:${lab}`;
  const [done, setDone] = useState<Set<string>>(() => new Set(loadDone(storeKey)));
  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify([...done])); } catch { /* storage unavailable: progress is per page view */ }
  }, [done, storeKey]);
  const count = sections.filter((s) => done.has(s.id)).length;
  const all = sections.length > 0 && count === sections.length;
  const toggle = (id: string) => setDone((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="learn-layout">
      <div>
        <div className="learn-progress">
          <div className="spread">
            <strong>{all ? 'All sections done' : `Section progress: ${count} of ${sections.length}`}</strong>
            {all && <span className="pop celebrate" aria-hidden>🎉</span>}
          </div>
          <Bar value={count} max={sections.length} tone={all ? 'good' : undefined} label={`${count} of ${sections.length} sections done`} />
        </div>
        <Blocks tokens={intro} keyPrefix="intro" />
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className={`learn-section${done.has(s.id) ? ' done' : ''}`} aria-labelledby={`${s.id}-h`}>
            <div className="learn-section-head">
              <span className="learn-num" aria-hidden>{done.has(s.id) ? <Icon name="check" size={15} /> : i + 1}</span>
              <h2 id={`${s.id}-h`}><InlineMd text={s.title.replace(/^\d+\.\s*/, '')} /></h2>
            </div>
            <div className="prose"><Blocks tokens={s.tokens} keyPrefix={s.id} /></div>
            <div className="learn-section-foot">
              <button type="button" className={`btn btn-small${done.has(s.id) ? ' btn-done' : ''}`} aria-pressed={done.has(s.id)} onClick={() => toggle(s.id)}>
                <Icon name={done.has(s.id) ? 'check' : 'sparkle'} size={14} />{done.has(s.id) ? 'Got it' : 'Mark as understood'}
              </button>
              {i < sections.length - 1 && (
                <a className="tiny" href={`#${sections[i + 1]!.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(sections[i + 1]!.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  Next: {sections[i + 1]!.title.replace(/[`*]/g, '').replace(/^\d+\.\s*/, '')} ↓
                </a>
              )}
            </div>
          </section>
        ))}
        {resources.length > 0 && <Resources items={resources} />}
        {footer}
      </div>
      {sections.length > 2 && (
        <nav className="toc" aria-label="On this page">
          <div className="sidebar-title">On this page</div>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={done.has(s.id) ? 'done' : ''} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              {done.has(s.id) ? '✓ ' : ''}{s.title.replace(/[`*]/g, '')}
            </a>
          ))}
          <a href="#further-reading" onClick={(e) => { e.preventDefault(); document.getElementById('further-reading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Further reading</a>
        </nav>
      )}
    </div>
  );
}

const KIND_ICON = { docs: 'book', tutorial: 'sparkle', package: 'layers', tool: 'settings', video: 'eye' } as const;

export function Resources({ items }: { items: Resource[] }) {
  return (
    <section id="further-reading" className="learn-section" aria-labelledby="further-reading-h">
      <div className="learn-section-head">
        <span className="learn-num" aria-hidden><Icon name="external" size={15} /></span>
        <h2 id="further-reading-h">Further reading</h2>
      </div>
      <p className="small muted">Official documentation and tutorials — optional, for when you want to go deeper.</p>
      <ul className="resource-list">
        {items.map((r) => (
          <li key={r.url}>
            <a href={r.url} target="_blank" rel="noreferrer">
              <span className="resource-icon"><Icon name={KIND_ICON[r.kind]} size={17} /></span>
              <span className="resource-text"><strong>{r.title}</strong>{r.note && <span className="small muted">{r.note}</span>}</span>
              <Icon name="external" size={14} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

