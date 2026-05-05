"""
Tool Registry
=============

Tools are async callables agents can invoke. Each is a small, well-defined
operation: web search, calculator, comparison table builder, etc.

In a production setup, web_search would hit Tavily / Serper / Brave Search.
For zero-config deploy we use DuckDuckGo's instant-answer endpoint (no API
key required) plus a curated knowledge base for common business topics.
"""

from __future__ import annotations

import ast
import math
import operator
import re
from dataclasses import dataclass
from typing import Any, Callable

import httpx


@dataclass
class Tool:
    name: str
    description: str
    category: str
    available_to: list[str]
    handler: Callable


# ─── Tool implementations ────────────────────────────────────────────────────
async def web_search(query: str) -> dict:
    """
    Live web search via DuckDuckGo Instant Answer API.
    Returns a list of result snippets and the abstract if available.

    No API key required — works out of the box on any deploy.
    """
    if not query:
        return {"error": "query is required", "results": []}

    url = "https://api.duckduckgo.com/"
    params = {
        "q": query, "format": "json",
        "no_html": "1", "skip_disambig": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, params=params)
        if r.status_code != 200:
            return {"error": f"status {r.status_code}", "results": []}
        data = r.json()
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}", "results": []}

    results = []
    if data.get("AbstractText"):
        results.append({
            "title": data.get("Heading", query),
            "snippet": data["AbstractText"],
            "url": data.get("AbstractURL", ""),
            "source": data.get("AbstractSource", "DuckDuckGo"),
        })
    for topic in (data.get("RelatedTopics") or [])[:6]:
        if isinstance(topic, dict) and topic.get("Text"):
            results.append({
                "title": (topic.get("Text", "")[:60] + "...") if len(topic.get("Text", "")) > 60 else topic.get("Text", ""),
                "snippet": topic.get("Text", ""),
                "url": topic.get("FirstURL", ""),
                "source": "DuckDuckGo",
            })
    if not results:
        results.append({
            "title": query,
            "snippet": f"No instant-answer results for '{query}'. Researcher should reason from prior knowledge.",
            "url": "",
            "source": "fallback",
        })
    return {"query": query, "results": results, "count": len(results)}


async def fetch_url(url: str) -> dict:
    """Fetch a URL and return a text excerpt (max ~3KB)."""
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return {"error": "valid http(s) URL required"}
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "AGENTFORGE/1.0"})
        if r.status_code != 200:
            return {"error": f"status {r.status_code}", "url": url}
        # Strip HTML tags for a rough text extract
        text = re.sub(r"<script.*?</script>", "", r.text, flags=re.S | re.I)
        text = re.sub(r"<style.*?</style>", "", text, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return {
            "url": url,
            "text_excerpt": text[:3000],
            "length": len(text),
        }
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}", "url": url}


# Curated knowledge base for common business topics — works offline, no api needed
_KNOWLEDGE_BASE = {
    "saas pricing models": (
        "Common SaaS pricing models: (1) Per-user/seat pricing (Slack, Salesforce) — "
        "scales with team size, predictable. (2) Tiered (Notion, Figma) — Free/Pro/Team/"
        "Enterprise feature gates. (3) Usage-based (AWS, Twilio) — pay per API call/GB/etc, "
        "variable revenue but high adoption. (4) Freemium (Dropbox, Zoom) — free entry, "
        "convert to paid via limits. (5) Flat-rate (Basecamp) — single price, simplifies sales."
    ),
    "market sizing": (
        "Market sizing approaches: TAM (total addressable market — total demand for category), "
        "SAM (serviceable addressable market — TAM you can target with your model), "
        "SOM (serviceable obtainable market — realistic capture in 3-5 years). "
        "Top-down: industry reports × penetration %. Bottom-up: customers × ACV — "
        "more credible for investors."
    ),
    "customer acquisition cost": (
        "CAC = total sales+marketing spend / new customers acquired. "
        "Healthy ratio LTV:CAC ≥ 3:1. Payback period < 12 months ideal for SaaS, "
        "< 18 months acceptable. Enterprise SaaS often runs 6-9 month payback. "
        "Watch CAC trend — rising CAC with flat LTV signals saturation."
    ),
    "competitive analysis framework": (
        "Porter's Five Forces: rivalry, new entrants, suppliers, buyers, substitutes. "
        "SWOT: strengths/weaknesses (internal), opportunities/threats (external). "
        "For competitive positioning: feature matrix vs top 3-5 competitors, "
        "pricing comparison, go-to-market motion (PLG vs sales-led), and moat analysis."
    ),
    "go to market strategy": (
        "GTM components: ICP (ideal customer profile), positioning statement, "
        "pricing & packaging, sales motion (PLG / inside sales / field sales / channel), "
        "marketing channels (content / paid / events / partnerships), and success metrics "
        "(pipeline, conversion, ACV, payback). Match motion to ACV: <$1k PLG, $1-50k inside, $50k+ field."
    ),
    "unit economics": (
        "Unit economics measures profitability per customer. Key metrics: gross margin, "
        "CAC, LTV, payback period, burn multiple. For SaaS: gross margin > 70%, "
        "LTV/CAC > 3, payback < 18 months, NRR > 110% for healthy growth."
    ),
}


async def knowledge_base(topic: str) -> dict:
    """Look up curated reference info on common business topics."""
    if not topic:
        return {"error": "topic required"}
    key = topic.lower().strip()
    # exact + fuzzy match
    for kb_key, content in _KNOWLEDGE_BASE.items():
        if kb_key in key or key in kb_key:
            return {"topic": kb_key, "content": content, "source": "AGENTFORGE knowledge base"}
    # word overlap fallback
    topic_words = set(key.split())
    best_score = 0
    best_entry = None
    for kb_key, content in _KNOWLEDGE_BASE.items():
        score = len(topic_words & set(kb_key.split()))
        if score > best_score:
            best_score = score
            best_entry = (kb_key, content)
    if best_entry and best_score > 0:
        return {"topic": best_entry[0], "content": best_entry[1], "source": "AGENTFORGE knowledge base (closest match)"}
    return {
        "topic": topic,
        "content": f"No curated entry for '{topic}'. Available topics: {', '.join(_KNOWLEDGE_BASE.keys())}",
        "source": "AGENTFORGE knowledge base",
    }


# Safe arithmetic evaluator
_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod,
    ast.FloorDiv: operator.floordiv, ast.USub: operator.neg, ast.UAdd: operator.pos,
}
_FUNCS = {
    "sqrt": math.sqrt, "log": math.log, "log10": math.log10, "exp": math.exp,
    "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "abs": abs, "round": round, "min": min, "max": max,
}


def _eval_node(node):
    if isinstance(node, ast.Num):
        return node.n
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.BinOp):
        return _OPS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp):
        return _OPS[type(node.op)](_eval_node(node.operand))
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        fn = _FUNCS.get(node.func.id)
        if not fn:
            raise ValueError(f"Function not allowed: {node.func.id}")
        return fn(*[_eval_node(a) for a in node.args])
    raise ValueError(f"Unsupported expression node: {type(node).__name__}")


async def calculator(expression: str) -> dict:
    """Evaluate a math expression safely. Supports +-*/^%, sqrt/log/sin/cos, etc."""
    if not expression:
        return {"error": "expression required"}
    try:
        tree = ast.parse(expression, mode="eval")
        result = _eval_node(tree.body)
        return {"expression": expression, "result": result}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}", "expression": expression}


async def compare(items: list) -> dict:
    """Build a structured comparison from a list of dicts."""
    if not items or not isinstance(items, list):
        return {"error": "items must be a non-empty list of dicts"}
    keys = []
    for item in items:
        if isinstance(item, dict):
            for k in item.keys():
                if k not in keys:
                    keys.append(k)
    rows = []
    for item in items:
        rows.append([str(item.get(k, "—")) if isinstance(item, dict) else str(item) for k in keys])
    return {
        "headers": keys,
        "rows": rows,
        "count": len(items),
    }


async def summarize(text: str) -> dict:
    """Basic summarizer — picks first/last sentences and longest sentence."""
    if not text:
        return {"error": "text required"}
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    if len(sentences) <= 3:
        return {"summary": text, "method": "passthrough", "sentence_count": len(sentences)}
    longest = max(sentences, key=len)
    summary = " ".join(dict.fromkeys([sentences[0], longest, sentences[-1]]))
    return {
        "summary": summary,
        "method": "extractive",
        "sentence_count": len(sentences),
        "compression_ratio": round(len(summary) / len(text), 2),
    }


# ─── Registry ────────────────────────────────────────────────────────────────
TOOL_REGISTRY: dict[str, Tool] = {
    "web_search": Tool(
        name="web_search",
        description="Live web search via DuckDuckGo. Returns top result snippets.",
        category="information",
        available_to=["researcher"],
        handler=web_search,
    ),
    "fetch_url": Tool(
        name="fetch_url",
        description="Fetch and extract text content from a specific URL.",
        category="information",
        available_to=["researcher"],
        handler=fetch_url,
    ),
    "knowledge_base": Tool(
        name="knowledge_base",
        description="Curated reference info on common business topics (SaaS pricing, market sizing, etc).",
        category="information",
        available_to=["researcher"],
        handler=knowledge_base,
    ),
    "calculator": Tool(
        name="calculator",
        description="Evaluate math expressions safely. Supports basic ops + sqrt/log/sin/cos.",
        category="computation",
        available_to=["analyst"],
        handler=calculator,
    ),
    "compare": Tool(
        name="compare",
        description="Build a structured comparison table from a list of items.",
        category="synthesis",
        available_to=["analyst"],
        handler=compare,
    ),
    "summarize": Tool(
        name="summarize",
        description="Distill long text into key points using extractive summarization.",
        category="synthesis",
        available_to=["analyst"],
        handler=summarize,
    ),
}


async def run_tool(name: str, input_data: dict) -> Any:
    """Dispatch a tool call by name."""
    tool = TOOL_REGISTRY.get(name)
    if not tool:
        return {"error": f"unknown tool: {name}"}
    try:
        # tools take a single primary arg
        if name in ("web_search", "knowledge_base", "summarize"):
            arg = input_data.get("query") or input_data.get("topic") or input_data.get("text") or ""
            return await tool.handler(arg)
        if name == "fetch_url":
            return await tool.handler(input_data.get("url", ""))
        if name == "calculator":
            return await tool.handler(input_data.get("expression", ""))
        if name == "compare":
            return await tool.handler(input_data.get("items", []))
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}
    return {"error": "unhandled tool dispatch"}
