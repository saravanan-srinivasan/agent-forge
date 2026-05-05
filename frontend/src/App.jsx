import React, { useState, useEffect, useMemo } from 'react';
import {
  Play, Pause, Plus, History, Search, BarChart3, AlertTriangle,
  Sparkles, CheckCircle2, X, Compass, Menu,
} from 'lucide-react';

import AgentNetwork from './components/AgentNetwork.jsx';
import ConversationTranscript from './components/ConversationTranscript.jsx';
import ObjectiveComposer from './components/ObjectiveComposer.jsx';
import ExecutionMetrics from './components/ExecutionMetrics.jsx';
import AgentRoster from './components/AgentRoster.jsx';
import HistoryDrawer from './components/HistoryDrawer.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import CommandPalette from './components/CommandPalette.jsx';

import { api, streamWorkflow } from './utils/api.js';
import { agentOf } from './utils/agents.js';
import { Markdown, formatDuration } from './utils/markdown.jsx';
import { useIsMobile } from './hooks/useMediaQuery.js';

export default function App() {
  // Workflow inputs
  const [objective, setObjective] = useState('');
  const [context, setContext] = useState('');
  const [agentsEnabled, setAgentsEnabled] = useState(['planner', 'researcher', 'analyst']);
  const [templates, setTemplates] = useState([]);

  // Live execution state
  const [events, setEvents] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [finalAnswer, setFinalAnswer] = useState(null);
  const [error, setError] = useState(null);
  const [activeAgent, setActiveAgent] = useState(null);
  const [workflowId, setWorkflowId] = useState(null);
  const [completedMeta, setCompletedMeta] = useState(null);

  // Panels
  const [showHistory, setShowHistory] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [mobileTab, setMobileTab] = useState('compose');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // System
  const [backendOnline, setBackendOnline] = useState(false);
  const [cancelStream, setCancelStream] = useState(null);

  const isMobile = useIsMobile();

  // ─── Initial loads ──────────────────────────────────────────────
  useEffect(() => {
    api.listTemplates().then(d => setTemplates(d.templates || [])).catch(() => {});
    pingBackend();
    const i = setInterval(pingBackend, 30000);
    return () => clearInterval(i);
  }, []);

  async function pingBackend() {
    try {
      const ok = await api.ping();
      setBackendOnline(ok);
    } catch {
      setBackendOnline(false);
    }
  }

  // ─── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const ctrl = e.metaKey || e.ctrlKey;
      if (ctrl && e.key === 'k') { e.preventDefault(); setShowCommand(true); }
      else if (ctrl && e.key === 'Enter') { e.preventDefault(); runWorkflow(); }
      else if (ctrl && e.key === 'h') { e.preventDefault(); setShowHistory(true); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); setShowDashboard(true); }
      else if (ctrl && e.shiftKey && e.key === 'N') { e.preventDefault(); newWorkflow(); }
      else if (e.key === 'Escape' && isRunning) cancelWorkflow();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [objective, context, agentsEnabled, isRunning]);

  // ─── Workflow control ───────────────────────────────────────────
  function newWorkflow() {
    cancelStream?.();
    setObjective('');
    setContext('');
    setEvents([]);
    setIsRunning(false);
    setStartedAt(null);
    setFinalAnswer(null);
    setError(null);
    setActiveAgent(null);
    setWorkflowId(null);
    setCompletedMeta(null);
    setMobileTab('compose');
  }

  function loadTemplate(t) {
    setObjective(t.objective);
    setContext(t.context || '');
    setEvents([]);
    setFinalAnswer(null);
    setError(null);
  }

  function loadWorkflow(w) {
    setObjective(w.objective);
    setContext(w.context || '');
    setEvents(w.events || []);
    setFinalAnswer(w.final_answer);
    setWorkflowId(w.id);
    setStartedAt(w.started_at);
    setCompletedMeta({
      total_tokens: w.total_tokens,
      tokens_by_agent: w.tokens_by_agent,
      tool_calls_count: w.tool_calls_count,
      elapsed_ms: w.elapsed_ms,
    });
    setError(w.error || null);
    setMobileTab('output');
  }

  function cancelWorkflow() {
    cancelStream?.();
    setIsRunning(false);
    setActiveAgent(null);
  }

  function runWorkflow() {
    if (!objective.trim()) {
      setError('Provide an objective to run the crew on.');
      return;
    }
    setError(null);
    setEvents([]);
    setFinalAnswer(null);
    setCompletedMeta(null);
    setIsRunning(true);
    setStartedAt(Date.now());
    setActiveAgent('planner');
    if (isMobile) setMobileTab('output');

    const cancel = streamWorkflow(
      {
        objective,
        context,
        agents_enabled: agentsEnabled,
        max_iterations: 6,
      },
      {
        onEvent: (kind, data) => {
          if (kind === 'workflow_started') {
            setWorkflowId(data.workflow_id);
            return;
          }
          if (kind === 'workflow_completed') {
            setFinalAnswer(data.final_answer);
            setIsRunning(false);
            setActiveAgent(null);
            setCompletedMeta({
              total_tokens: data.total_tokens,
              tokens_by_agent: data.tokens_by_agent,
              tool_calls_count: data.tool_calls_count,
              elapsed_ms: data.elapsed_ms,
            });
            return;
          }
          if (kind === 'workflow_error') {
            setError(data.message || 'Workflow failed');
            setIsRunning(false);
            setActiveAgent(null);
            return;
          }

          const agentEvent = {
            kind,
            timestamp: data.timestamp || Date.now(),
            agent: data.agent,
            message: data.message,
            tool_name: data.tool_name,
            tool_input: data.tool_input,
            tool_output: data.tool_output,
            target_agent: data.target_agent,
            payload: data.payload || {},
          };
          setEvents(prev => [...prev, agentEvent]);

          if (kind === 'agent_thinking' || kind === 'tool_call_started') {
            if (data.agent) setActiveAgent(data.agent);
          }
          if (kind === 'agent_handoff' && data.target_agent) {
            setActiveAgent(data.target_agent);
          }
          if (kind === 'agent_message' && data.payload?.final) {
            setActiveAgent(null);
          }
        },
        onError: (e) => {
          setError(`Connection failed: ${e.message}. Is the backend running?`);
          setIsRunning(false);
          setActiveAgent(null);
        },
        onClose: () => {
          setIsRunning(false);
        },
      }
    );

    setCancelStream(() => cancel);
  }

  const liveStatus = useMemo(() => {
    if (error) return { label: 'ERROR', color: '#ef4444' };
    if (isRunning && activeAgent) {
      const a = agentOf(activeAgent);
      return { label: `${a.name} ACTIVE`, color: a.color };
    }
    if (isRunning) return { label: 'RUNNING', color: 'var(--signal)' };
    if (finalAnswer) return { label: 'COMPLETE', color: '#4ade80' };
    return { label: 'READY', color: 'var(--ink-mute)' };
  }, [isRunning, activeAgent, error, finalAnswer]);

  const commands = [
    { label: 'Run workflow', icon: Play, color: '#fbbf24', shortcut: '⌘↵', hint: 'Execute the crew on the current objective', action: runWorkflow },
    { label: 'New workflow', icon: Plus, color: '#4ade80', shortcut: '⌘⇧N', hint: 'Clear and start fresh', action: newWorkflow },
    { label: 'Open archive', icon: History, color: '#60a5fa', shortcut: '⌘H', hint: 'Browse past workflows', action: () => setShowHistory(true) },
    { label: 'Open analytics', icon: BarChart3, color: '#c084fc', shortcut: '⌘D', hint: 'Aggregate crew performance', action: () => setShowDashboard(true) },
    { label: 'Cancel running workflow', icon: Pause, color: '#ef4444', hint: 'Stop the crew (ESC)', action: cancelWorkflow },
    ...templates.map(t => ({
      label: `Template: ${t.title}`,
      icon: Sparkles,
      color: 'var(--signal)',
      hint: t.description,
      action: () => loadTemplate(t),
    })),
  ];

  return (
    <div className="blueprint-grid" style={{
      minHeight: '100dvh',
      color: 'var(--ink)',
      position: 'relative',
    }}>
      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 10, 12, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line-soft)',
      }}>
        <div style={{
          maxWidth: '1600px', margin: '0 auto',
          padding: isMobile ? '12px 16px' : '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <Logo />
            <div className="hide-mobile" style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--ink-bright)',
                letterSpacing: '0.02em',
              }}>AGENTFORGE</div>
              <div className="label-mono" style={{ marginTop: '2px' }}>
                multi-agent · python · crewai · autogen
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusPill label={liveStatus.label} color={liveStatus.color} />

            <div className="hide-mobile" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '4px',
              border: `1px solid ${backendOnline ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              background: backendOnline ? 'rgba(74, 222, 128, 0.04)' : 'rgba(239, 68, 68, 0.04)',
            }}>
              <span className="pulse-dot" style={{
                display: 'inline-block', width: '5px', height: '5px',
                borderRadius: '50%',
                background: backendOnline ? '#4ade80' : '#ef4444',
              }} />
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9.5px',
                color: backendOnline ? '#4ade80' : '#ef4444',
                fontWeight: 600,
                letterSpacing: '0.12em',
              }}>BACKEND</span>
            </div>

            <button
              onClick={() => setShowCommand(true)}
              className="hover-lift hide-mobile"
              style={{
                padding: '6px 12px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '4px',
                color: 'var(--ink-soft)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Search size={11} /> CMD <kbd>⌘K</kbd>
            </button>

            <button
              onClick={() => setShowHistory(true)}
              className="hover-lift hide-mobile"
              style={{
                padding: '6px 10px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '4px',
                color: 'var(--ink-soft)',
              }}
            ><History size={12} /></button>

            <button
              onClick={() => setShowDashboard(true)}
              className="hover-lift hide-mobile"
              style={{
                padding: '6px 10px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '4px',
                color: 'var(--ink-soft)',
              }}
            ><BarChart3 size={12} /></button>

            <button
              onClick={newWorkflow}
              className="hover-lift hide-mobile"
              style={{
                padding: '6px 14px',
                background: 'var(--signal)',
                color: '#0a0a0c',
                fontWeight: 700,
                borderRadius: '4px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                letterSpacing: '0.08em',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            ><Plus size={12} /> NEW</button>

            <button
              onClick={() => setMobileNavOpen(true)}
              className="show-only-mobile hover-lift"
              style={{
                padding: '8px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '4px',
                color: 'var(--ink-soft)',
              }}
            ><Menu size={15} /></button>
          </div>
        </div>
      </header>

      {/* Mobile tab strip */}
      {isMobile && (
        <div style={{
          position: 'sticky',
          top: '57px',
          zIndex: 40,
          background: 'rgba(10, 10, 12, 0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          padding: '4px',
          gap: '4px',
        }}>
          {[
            { id: 'compose', label: 'OBJECTIVE', icon: Sparkles },
            { id: 'output',  label: 'OUTPUT',    icon: BarChart3 },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '4px',
                  background: mobileTab === t.id ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                  border: `1px solid ${mobileTab === t.id ? 'rgba(251, 191, 36, 0.3)' : 'transparent'}`,
                  color: mobileTab === t.id ? 'var(--signal)' : 'var(--ink-soft)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}
              >
                <Icon size={11} /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* MAIN GRID */}
      <main style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: isMobile ? '14px' : '20px 24px 40px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '380px 1fr 280px',
        gap: isMobile ? '14px' : '18px',
      }}>
        {/* LEFT — OBJECTIVE COMPOSER */}
        {(!isMobile || mobileTab === 'compose') && (
          <section style={{ animation: 'slide-from-left 0.3s ease-out' }}>
            <SectionLabel label="01 / Define Objective" hint="What should the crew solve?" />
            <ObjectiveComposer
              objective={objective}
              setObjective={setObjective}
              context={context}
              setContext={setContext}
              agentsEnabled={agentsEnabled}
              setAgentsEnabled={setAgentsEnabled}
              templates={templates}
              onLoadTemplate={loadTemplate}
              isRunning={isRunning}
            />

            {error && (
              <div style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.06)',
                color: '#fca5a5',
                fontSize: '12.5px',
                fontFamily: 'JetBrains Mono, monospace',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertTriangle size={13} />
                {error}
              </div>
            )}

            <button
              onClick={isRunning ? cancelWorkflow : runWorkflow}
              disabled={!isRunning && !objective.trim()}
              className="hover-lift"
              style={{
                marginTop: '14px',
                width: '100%',
                padding: '14px',
                background: isRunning ? 'rgba(239, 68, 68, 0.1)' : 'var(--signal)',
                color: isRunning ? '#ef4444' : '#0a0a0c',
                border: isRunning ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                borderRadius: '4px',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.14em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {isRunning ? (
                <><Pause size={13} /> ABORT WORKFLOW <kbd style={{ marginLeft: '4px' }}>ESC</kbd></>
              ) : (
                <><Play size={13} fill="currentColor" /> EXECUTE CREW <kbd style={{ marginLeft: '4px' }}>⌘↵</kbd></>
              )}
            </button>

            {!isMobile && <div style={{ marginTop: '18px' }}><AgentRoster agentsEnabled={agentsEnabled} /></div>}
          </section>
        )}

        {/* CENTER — NETWORK + TRANSCRIPT */}
        {(!isMobile || mobileTab === 'output') && (
          <section style={{ animation: 'fade-in 0.4s ease-out 0.05s backwards', minWidth: 0 }}>
            <SectionLabel label="02 / Crew Orchestration" hint="Live agent collaboration" />
            <div className="panel-elev" style={{ padding: '16px', marginBottom: '16px' }}>
              <AgentNetwork events={events} activeAgent={activeAgent} />
            </div>

            <SectionLabel label="03 / Execution Trace" hint="Step-by-step reasoning" />

            {events.length === 0 && !finalAnswer && !isRunning && <EmptyState />}

            {(events.length > 0 || isRunning) && (
              <ConversationTranscript
                events={events}
                finalAnswer={finalAnswer}
                isRunning={isRunning}
              />
            )}

            {finalAnswer && (
              <div className="bracket fade-in" style={{
                marginTop: '20px',
                padding: '20px 22px',
                background: 'var(--bg-base)',
                border: `1px solid rgba(74, 222, 128, 0.3)`,
                borderRadius: '6px',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '14px', flexWrap: 'wrap', gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.16em',
                      color: '#4ade80',
                    }}>FINAL ANSWER · VEGA</span>
                  </div>
                  {completedMeta && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <MetaPill label="time" value={formatDuration(completedMeta.elapsed_ms)} />
                      <MetaPill label="tokens" value={completedMeta.total_tokens.toLocaleString()} />
                      <MetaPill label="tools" value={completedMeta.tool_calls_count} />
                    </div>
                  )}
                </div>
                <Markdown text={finalAnswer} accent="#60a5fa" />
              </div>
            )}
          </section>
        )}

        {/* RIGHT — METRICS */}
        {(!isMobile || mobileTab === 'compose') && (
          <aside style={{ animation: 'slide-from-right 0.3s ease-out 0.1s backwards' }}>
            <SectionLabel label="04 / Live Telemetry" hint="" />
            <ExecutionMetrics events={events} isRunning={isRunning} startedAt={startedAt} />

            <div style={{ marginTop: '18px' }}>
              <SectionLabel label="05 / Shortcuts" hint="" />
              <div className="panel-elev" style={{ padding: '14px' }}>
                <ShortcutRow label="Run workflow"   keys={['⌘', '↵']} />
                <ShortcutRow label="Cancel"          keys={['ESC']} />
                <ShortcutRow label="Command palette" keys={['⌘', 'K']} />
                <ShortcutRow label="Open archive"    keys={['⌘', 'H']} />
                <ShortcutRow label="Analytics"       keys={['⌘', 'D']} />
                <ShortcutRow label="New workflow"    keys={['⌘', '⇧', 'N']} />
              </div>
            </div>

            {isMobile && (
              <div style={{ marginTop: '18px' }}>
                <AgentRoster agentsEnabled={agentsEnabled} />
              </div>
            )}
          </aside>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '40px 20px 30px',
        fontSize: '10.5px',
        color: 'var(--ink-mute)',
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.16em',
      }}>
        <span style={{ color: 'var(--signal)', fontWeight: 700 }}>AGENTFORGE</span>
        {' · '}
        multi-agent orchestration
        {' · '}
        python <span style={{ color: 'var(--ink-soft)' }}>+</span> fastapi
        {' · '}
        groq llm
      </footer>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '260px',
              maxWidth: '80vw',
              height: '100%',
              background: 'var(--bg-base)',
              borderLeft: '1px solid var(--line-mid)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'slide-from-right 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="label-mono">menu</span>
              <button onClick={() => setMobileNavOpen(false)} style={{ padding: '4px', color: 'var(--ink-soft)' }}>
                <X size={14} />
              </button>
            </div>
            <MobileNavBtn icon={Plus}      label="New workflow"     onClick={() => { newWorkflow(); setMobileNavOpen(false); }} />
            <MobileNavBtn icon={Search}    label="Command palette"  onClick={() => { setShowCommand(true); setMobileNavOpen(false); }} />
            <MobileNavBtn icon={History}   label="Archive"          onClick={() => { setShowHistory(true); setMobileNavOpen(false); }} />
            <MobileNavBtn icon={BarChart3} label="Analytics"        onClick={() => { setShowDashboard(true); setMobileNavOpen(false); }} />
          </div>
        </div>
      )}

      <HistoryDrawer  open={showHistory}   onClose={() => setShowHistory(false)}   onLoad={loadWorkflow} />
      <StatsDashboard open={showDashboard} onClose={() => setShowDashboard(false)} />
      <CommandPalette open={showCommand}   onClose={() => setShowCommand(false)}   commands={commands} />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{
      width: '36px', height: '36px',
      borderRadius: '6px',
      background: 'var(--signal)',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 18px rgba(251, 191, 36, 0.35)',
    }}>
      <svg viewBox="0 0 32 32" width="22" height="22">
        <path d="M10 22 L16 8 L22 22" stroke="#0a0a0c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 16 L20 16" stroke="#0a0a0c" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function StatusPill({ label, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '5px 10px',
      borderRadius: '4px',
      border: `1px solid ${color}66`,
      background: `${color}10`,
    }}>
      <span className="pulse-dot" style={{
        display: 'inline-block', width: '5px', height: '5px',
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }} />
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9.5px',
        color: color,
        fontWeight: 700,
        letterSpacing: '0.14em',
      }}>{label}</span>
    </div>
  );
}

function SectionLabel({ label, hint }) {
  return (
    <div style={{
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
      }}>{label}</span>
      {hint && (
        <span style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: '11px',
          color: 'var(--ink-mute)',
          fontStyle: 'italic',
        }}>{hint}</span>
      )}
    </div>
  );
}

function MetaPill({ label, value }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 8px',
      borderRadius: '3px',
      background: 'var(--bg-deep)',
      border: '1px solid var(--line-soft)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
    }}>
      <span style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</span>
      <span style={{ color: 'var(--ink-bright)', fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function ShortcutRow({ label, keys }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '5px 0',
    }}>
      <span style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>{label}</span>
      <div style={{ display: 'flex', gap: '3px' }}>
        {keys.map((k, i) => <kbd key={i}>{k}</kbd>)}
      </div>
    </div>
  );
}

function MobileNavBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="hover-lift"
      style={{
        padding: '12px 14px',
        background: 'var(--bg-elev-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: '4px',
        color: 'var(--ink)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textAlign: 'left',
        fontSize: '13px',
      }}
    >
      <Icon size={14} style={{ color: 'var(--signal)' }} />
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      padding: '40px 20px',
      textAlign: 'center',
      border: '1px dashed var(--line-soft)',
      borderRadius: '6px',
      background: 'rgba(255, 255, 255, 0.01)',
    }}>
      <div style={{
        width: '60px', height: '60px',
        margin: '0 auto 18px',
        borderRadius: '6px',
        background: 'rgba(251, 191, 36, 0.06)',
        border: '1px solid rgba(251, 191, 36, 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Compass size={24} style={{ color: 'var(--signal)' }} />
      </div>
      <div className="serif-display" style={{
        fontSize: '22px',
        color: 'var(--ink-bright)',
        marginBottom: '6px',
      }}>Crew standing by</div>
      <div style={{
        fontSize: '12.5px',
        color: 'var(--ink-mute)',
        maxWidth: '380px',
        margin: '0 auto',
        lineHeight: 1.6,
      }}>
        Define an objective on the left, then execute. ATLAS will plan, ORION will research,
        and VEGA will synthesize the answer — live, with full reasoning trace.
      </div>
    </div>
  );
}
