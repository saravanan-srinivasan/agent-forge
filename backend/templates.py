"""Pre-built workflow templates the user can launch with one click."""

from models import Template


WORKFLOW_TEMPLATES: list[Template] = [
    Template(
        id="market_analysis",
        title="Market Analysis",
        description="Size a market, identify key players, and produce an opportunity assessment.",
        objective="Analyze the market for AI-powered code review tools. Assess market size, top 3 competitors, pricing models, and the gap a new entrant could exploit.",
        context="Target audience: engineering teams 50-500 developers at SaaS companies.",
        icon="trending-up",
        category="strategy",
    ),
    Template(
        id="competitive_research",
        title="Competitive Deep-Dive",
        description="Research competitors and produce a feature/pricing/positioning matrix.",
        objective="Research the top 3 competitors in the password manager space (1Password, Bitwarden, Dashlane). Compare their pricing tiers, key differentiators, and target segments.",
        context="We're considering launching a password manager focused on small dev teams.",
        icon="crosshair",
        category="strategy",
    ),
    Template(
        id="investment_thesis",
        title="Investment Thesis",
        description="Build a structured investment thesis with bull/bear cases and recommendation.",
        objective="Produce an investment thesis on Nvidia (NVDA). Analyze the bull case, bear case, key catalysts for the next 12 months, and give a buy/hold/sell recommendation with reasoning.",
        context="Time horizon: 12-18 months. Risk tolerance: moderate.",
        icon="line-chart",
        category="finance",
    ),
    Template(
        id="product_decision",
        title="Product Decision",
        description="Frame a product decision and recommend a path with trade-offs.",
        objective="We're deciding between three pricing models for a new B2B SaaS tool: per-seat ($20/user), tiered ($99/$299/$999/mo), or usage-based (per API call). Recommend the best fit and explain the trade-offs.",
        context="Target customer: marketing teams at mid-market companies (200-2000 employees).",
        icon="git-branch",
        category="product",
    ),
    Template(
        id="go_to_market",
        title="Go-to-Market Plan",
        description="Design a focused GTM strategy for a new product launch.",
        objective="Design a 90-day go-to-market plan for launching a developer productivity tool. Cover ICP, positioning, top 3 channels, pricing, and success metrics.",
        context="Bootstrapped, two-person team, $50k budget, prior audience of ~5k developers on Twitter.",
        icon="rocket",
        category="strategy",
    ),
    Template(
        id="hiring_decision",
        title="Hiring Decision",
        description="Evaluate a hiring trade-off across roles and seniority.",
        objective="We can hire either: (a) one Senior Backend Engineer ($180k), (b) two Mid Backend Engineers ($110k each), or (c) one Senior Engineer + a Designer. Which gets us to launch fastest?",
        context="Pre-seed startup, 3 founders, building a B2B SaaS analytics tool, runway 18 months.",
        icon="users",
        category="operations",
    ),
]
