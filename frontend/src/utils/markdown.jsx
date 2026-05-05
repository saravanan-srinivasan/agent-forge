import React from 'react';

/**
 * Lightweight markdown renderer.
 * Supports: ### headers, **bold**, `code`, ```fenced```, - bullets, plain paras.
 * Outputs styled to match the AGENTFORGE blueprint aesthetic.
 */
export function Markdown({ text, accent = '#fbbf24' }) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  return (
    <div className="markdown-root" style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--ink)' }}>
      {blocks.map((b, i) => renderBlock(b, i, accent))}
    </div>
  );
}

function parseBlocks(text) {
  const out = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing
      out.push({ type: 'code', lang, content: codeLines.join('\n') });
    } else if (line.startsWith('### ')) {
      out.push({ type: 'h3', content: line.slice(4).trim() });
      i++;
    } else if (line.startsWith('## ')) {
      out.push({ type: 'h2', content: line.slice(3).trim() });
      i++;
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push({ type: 'ul', items });
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push({ type: 'ol', items });
    } else if (line.trim() === '') {
      i++;
    } else {
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !/^#+\s/.test(lines[i]) && !/^\s*[-*\d]/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      out.push({ type: 'p', content: paraLines.join(' ') });
    }
  }
  return out;
}

function renderInline(text) {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return segments.map((s, j) => {
    if (s.startsWith('**') && s.endsWith('**'))
      return <strong key={j} style={{ color: 'var(--ink-bright)', fontWeight: 600 }}>{s.slice(2, -2)}</strong>;
    if (s.startsWith('`') && s.endsWith('`'))
      return <code key={j} style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12.5px',
        padding: '1px 6px', borderRadius: '3px',
        background: 'rgba(251, 191, 36, 0.08)',
        color: '#fcd34d',
        border: '1px solid rgba(251, 191, 36, 0.18)',
      }}>{s.slice(1, -1)}</code>;
    return <span key={j}>{s}</span>;
  });
}

function renderBlock(b, key, accent) {
  switch (b.type) {
    case 'h2':
    case 'h3':
      return (
        <div key={key} style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: b.type === 'h2' ? '17px' : '14px',
          fontWeight: 700,
          color: accent,
          margin: '20px 0 10px',
          paddingBottom: '6px',
          borderBottom: `1px solid ${accent}33`,
          letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{
            width: '4px', height: '4px',
            background: accent,
            boxShadow: `0 0 6px ${accent}`,
          }} />
          {b.content}
        </div>
      );
    case 'p':
      return <p key={key} style={{ margin: '0 0 10px' }}>{renderInline(b.content)}</p>;
    case 'ul':
      return (
        <ul key={key} style={{ margin: '0 0 10px', paddingLeft: '0', listStyle: 'none' }}>
          {b.items.map((it, j) => (
            <li key={j} style={{
              padding: '3px 0 3px 18px',
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute', left: 0, top: '11px',
                width: '6px', height: '1px', background: accent,
              }} />
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} style={{ margin: '0 0 10px', paddingLeft: '20px' }}>
          {b.items.map((it, j) => (
            <li key={j} style={{ padding: '3px 0' }}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre key={key} style={{
          margin: '10px 0',
          padding: '12px 14px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '12px',
          background: 'var(--bg-deep)',
          border: '1px solid var(--line-soft)',
          borderRadius: '4px',
          color: 'var(--ink)',
          overflow: 'auto',
          lineHeight: 1.5,
        }}><code>{b.content}</code></pre>
      );
    default:
      return null;
  }
}

export function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
