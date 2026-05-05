"""Pydantic models for the multi-agent system."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class AgentRole(str, Enum):
    planner = "planner"
    researcher = "researcher"
    analyst = "analyst"


class WorkflowState(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class WorkflowRequest(BaseModel):
    objective: str = Field(..., min_length=1, description="The business problem to solve")
    context: str = Field("", description="Optional background information")
    agents_enabled: Optional[list[str]] = Field(
        None, description="Which agents to use (default: all three)"
    )
    max_iterations: Optional[int] = Field(6, description="Max planning loop iterations")
    workflow_id: Optional[str] = Field(None, description="Resume an existing workflow id")


class AgentEvent(BaseModel):
    """A single event emitted during workflow execution."""
    kind: str  # workflow_started | agent_thinking | agent_message | tool_call_started ...
    timestamp: int
    agent: Optional[str] = None
    payload: dict = Field(default_factory=dict)

    # Convenience accessors used by some event kinds
    message: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[dict] = None
    tool_output: Optional[Any] = None
    target_agent: Optional[str] = None
    iteration: Optional[int] = None


class Workflow(BaseModel):
    id: str
    objective: str
    context: str = ""
    state: WorkflowState = WorkflowState.pending
    agents_enabled: list[str] = Field(default_factory=list)
    events: list[AgentEvent] = Field(default_factory=list)
    final_answer: str = ""
    total_tokens: int = 0
    tokens_by_agent: dict[str, int] = Field(default_factory=dict)
    tool_calls_count: int = 0
    started_at: int = 0
    ended_at: int = 0
    elapsed_ms: int = 0
    error: Optional[str] = None


class WorkflowResponse(BaseModel):
    workflow_id: str
    final_answer: str
    events: list[AgentEvent]
    total_tokens: int
    elapsed_ms: int


class Template(BaseModel):
    id: str
    title: str
    description: str
    objective: str
    context: str = ""
    icon: str = "sparkles"
    category: str = "general"
