import React, { useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

export default function ObjectiveComposer({
  objective, setObjective,
  context, setContext,
  agentsEnabled, setAgentsEnabled,
  templates,
  onLoadTemplate,
  isRunning,
}) {
  const [showTemplates, setShowTemplates] = useState(true);

  return (
    <div>
      {/* Templates strip */}
      {showTemplates && templates.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span className="label-mono" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={10} /> Templates
            </span>
            <button
              onClick={() => setShowTemplates(false)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                color: 'var(--ink-mute)',
                padding: '2px 6px',
              }}
            >hide</button>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            margin: '0 -2px',
          }}>
            {templates.map(t => (
              <TemplateChip key={t.id} template={t} onClick={() => onLoadTemplate(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Objective input */}
      <div className="panel-elev" style={{
        marginBottom: '10px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--line-soft)',
          background: 'var(--bg-base)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span className="label-mono">Objective</span>
          <span className="label-mono" style={{ color: 'var(--signal)' }}>
            required
          </span>
        </div>
        <textarea
          value={objective}
          onChange={e => setObjective(e.target.value)}
          disabled={isRunning}
          placeholder={`describe the business problem your crew should solve...

  example: "should we launch a free tier for our SaaS product?
  analyze conversion data, competitor strategies, and recommend a path."`}
          rows={5}
          style={{
            width: '100%',
            background: 'transparent',
            color: 'var(--ink)',
            padding: '14px',
            fontFamily: 'Manrope, sans-serif',
            fontSize: '14px',
            lineHeight: 1.6,
            border: 'none',
            resize: 'vertical',
            minHeight: '110px',
          }}
        />
      </div>

      {/* Context (collapsible) */}
      <details style={{
        marginBottom: '10px',
      }}>
        <summary style={{
          cursor: 'pointer',
          padding: '8px 12px',
          background: 'var(--bg-base)',
          border: '1px solid var(--line-soft)',
          borderRadius: '6px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--ink-soft)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <ChevronRight size={11} />
          additional context
          <span style={{ color: 'var(--ink-mute)', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>
            (optional)
          </span>
        </summary>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          disabled={isRunning}
          placeholder="e.g. 'target audience: enterprise SaaS', 'time horizon: 6 months', 'budget: $50k'"
          rows={3}
          style={{
            width: '100%',
            marginTop: '8px',
            background: 'var(--bg-base)',
            color: 'var(--ink)',
            padding: '12px',
            fontFamily: 'Manrope, sans-serif',
            fontSize: '13px',
            lineHeight: 1.6,
            border: '1px solid var(--line-soft)',
            borderRadius: '6px',
            resize: 'vertical',
            minHeight: '70px',
          }}
        />
      </details>

      {/* Agent toggles */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        marginBottom: '4px',
      }}>
        <span className="label-mono" style={{ marginRight: '4px', alignSelf: 'center' }}>crew:</span>
        {[
          { id: 'planner', name: 'ATLAS', color: '#fbbf24' },
          { id: 'researcher', name: 'ORION', color: '#4ade80' },
          { id: 'analyst', name: 'VEGA', color: '#60a5fa' },
        ].map(a => {
          const enabled = agentsEnabled.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => {
                if (a.id === 'analyst') return; // analyst is always required (gives final answer)
                setAgentsEnabled(enabled
                  ? agentsEnabled.filter(x => x !== a.id)
                  : [...agentsEnabled, a.id]
                );
              }}
              disabled={isRunning || a.id === 'analyst'}
              className="hover-lift"
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                border: `1px solid ${enabled ? a.color : 'var(--line-soft)'}`,
                background: enabled ? `${a.color}15` : 'var(--bg-base)',
                color: enabled ? a.color : 'var(--ink-mute)',
                cursor: a.id === 'analyst' ? 'default' : 'pointer',
              }}
            >
              {enabled ? '●' : '○'} {a.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TemplateChip({ template, onClick }) {
  return (
    <button
      onClick={onClick}
      className="hover-lift"
      style={{
        flexShrink: 0,
        padding: '10px 12px',
        background: 'var(--bg-base)',
        border: '1px solid var(--line-soft)',
        borderRadius: '6px',
        textAlign: 'left',
        minWidth: '180px',
        maxWidth: '220px',
      }}
    >
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9.5px',
        color: 'var(--signal)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: '4px',
        fontWeight: 600,
      }}>
        {template.category}
      </div>
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--ink-bright)',
        marginBottom: '4px',
      }}>{template.title}</div>
      <div style={{
        fontSize: '11px',
        color: 'var(--ink-mute)',
        lineHeight: 1.4,
        whiteSpace: 'normal',
      }}>{template.description}</div>
    </button>
  );
}
