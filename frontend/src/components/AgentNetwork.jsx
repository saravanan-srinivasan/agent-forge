import React, { useMemo } from 'react';
import { AGENTS, AGENT_ORDER } from '../utils/agents';

/**
 * Agent network graph — three nodes (planner, researcher, analyst) connected
 * by edges. Edges pulse when a message flows; nodes glow when active.
 *
 * Responsive: uses viewBox so it scales to any container.
 */
export default function AgentNetwork({ events = [], activeAgent = null, compact = false }) {
  // Determine each agent's state
  const states = useMemo(() => {
    const s = { planner: 'idle', researcher: 'idle', analyst: 'idle' };
    for (const e of events) {
      if (e.kind === 'agent_thinking' && e.agent) s[e.agent] = 'thinking';
      else if (e.kind === 'tool_call_started' && e.agent) s[e.agent] = 'tool';
      else if (e.kind === 'tool_call_completed' && e.agent) s[e.agent] = 'thinking';
      else if (e.kind === 'agent_message' && e.agent) s[e.agent] = 'done';
    }
    if (activeAgent) s[activeAgent] = s[activeAgent] === 'idle' ? 'thinking' : s[activeAgent];
    return s;
  }, [events, activeAgent]);

  // Active flow edges — set if a handoff has happened
  const flows = useMemo(() => {
    const f = { 'planner-researcher': false, 'researcher-analyst': false };
    for (const e of events) {
      if (e.kind === 'agent_handoff') {
        if (e.agent === 'planner' && e.target_agent === 'researcher')
          f['planner-researcher'] = true;
        if (e.agent === 'researcher' && e.target_agent === 'analyst')
          f['researcher-analyst'] = true;
      }
    }
    return f;
  }, [events]);

  const W = 640, H = compact ? 180 : 240;
  const positions = {
    planner:    { x: 110,         y: H / 2 },
    researcher: { x: W / 2,       y: H / 2 },
    analyst:    { x: W - 110,     y: H / 2 },
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        {/* Gradient for animated edge stroke */}
        <linearGradient id="edge-active" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(251, 191, 36, 0)" />
          <stop offset="50%" stopColor="rgba(251, 191, 36, 0.9)" />
          <stop offset="100%" stopColor="rgba(74, 222, 128, 0)" />
        </linearGradient>
        <linearGradient id="edge-active-2" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(74, 222, 128, 0)" />
          <stop offset="50%" stopColor="rgba(74, 222, 128, 0.9)" />
          <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" />
        </linearGradient>
        {/* Drop shadows */}
        <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background grid lines */}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`bg-h-${i}`}
          x1="0" y1={H * (i / 7)} x2={W} y2={H * (i / 7)}
          stroke="rgba(255,255,255,0.025)" strokeWidth="1"
        />
      ))}

      {/* Edges */}
      {AGENT_ORDER.slice(0, -1).map((from, i) => {
        const to = AGENT_ORDER[i + 1];
        const flowKey = `${from}-${to}`;
        const isActive = flows[flowKey];
        const a = positions[from], b = positions[to];
        const fromAgent = AGENTS[from];
        const toAgent = AGENTS[to];

        return (
          <g key={flowKey}>
            {/* Base line */}
            <line
              x1={a.x + 38} y1={a.y}
              x2={b.x - 38} y2={b.y}
              stroke={isActive ? `${fromAgent.color}99` : 'rgba(255,255,255,0.1)'}
              strokeWidth={isActive ? 2 : 1}
              strokeDasharray={isActive ? '0' : '4 4'}
              style={{ transition: 'all 0.4s ease' }}
            />
            {/* Animated flow particles */}
            {isActive && (
              <>
                <circle r="3" fill={fromAgent.color} filter="url(#glow-amber)">
                  <animateMotion
                    dur="1.8s"
                    repeatCount="indefinite"
                    path={`M ${a.x + 38} ${a.y} L ${b.x - 38} ${b.y}`}
                  />
                </circle>
                <circle r="2" fill={toAgent.color} filter="url(#glow-amber)" opacity="0.7">
                  <animateMotion
                    dur="1.8s"
                    begin="0.6s"
                    repeatCount="indefinite"
                    path={`M ${a.x + 38} ${a.y} L ${b.x - 38} ${b.y}`}
                  />
                </circle>
              </>
            )}
            {/* Tick marks at midpoint */}
            <line
              x1={(a.x + b.x) / 2 - 1} y1={a.y - 4}
              x2={(a.x + b.x) / 2 - 1} y2={a.y + 4}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
          </g>
        );
      })}

      {/* Nodes */}
      {AGENT_ORDER.map(role => {
        const a = AGENTS[role];
        const pos = positions[role];
        const state = states[role];
        const isActive = state === 'thinking' || state === 'tool';
        const isDone = state === 'done';

        return (
          <g key={role}>
            {/* Outer ring (active state) */}
            {isActive && (
              <circle
                cx={pos.x} cy={pos.y} r="44"
                fill="none"
                stroke={a.color}
                strokeWidth="1"
                opacity="0.35"
              >
                <animate attributeName="r" values="44;52;44" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Status dot */}
            <circle
              cx={pos.x + 30} cy={pos.y - 28}
              r="4"
              fill={state === 'idle' ? 'rgba(255,255,255,0.2)' : a.color}
            >
              {isActive && (
                <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
              )}
            </circle>
            {/* Hexagonal node */}
            <Hexagon
              cx={pos.x} cy={pos.y} r={36}
              fill={isActive || isDone ? `${a.color}1A` : 'rgba(255,255,255,0.02)'}
              stroke={isActive ? a.color : isDone ? `${a.color}99` : 'rgba(255,255,255,0.18)'}
              strokeWidth={isActive ? 2 : 1.2}
              filter={isActive ? 'url(#glow-amber)' : ''}
            />
            {/* Glyph */}
            <text
              x={pos.x} y={pos.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="22"
              fontWeight="500"
              fill={isActive || isDone ? a.color : 'rgba(255,255,255,0.5)'}
              style={{ transition: 'fill 0.3s' }}
            >{a.glyph}</text>
            {/* Label below */}
            <text
              x={pos.x} y={pos.y + 58}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="10"
              fontWeight="600"
              letterSpacing="0.15em"
              fill={isActive || isDone ? a.color : 'rgba(255,255,255,0.55)'}
              style={{ transition: 'fill 0.3s' }}
            >{a.name}</text>
            <text
              x={pos.x} y={pos.y + 72}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="8.5"
              letterSpacing="0.12em"
              fill="rgba(255,255,255,0.35)"
            >{role.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Hexagon({ cx, cy, r, fill, stroke, strokeWidth, filter }) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return (
    <polygon
      points={points.join(' ')}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      filter={filter}
      style={{ transition: 'all 0.3s' }}
    />
  );
}
