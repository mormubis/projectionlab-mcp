import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const KNOWLEDGE_BASE = `# ProjectionLab Knowledge Base

## FIRE Concepts
- Financial Independence: https://projectionlab.com/financial-terms/financial-independence
- FIRE: https://projectionlab.com/financial-terms/financial-independence-retire-early-fire
- FI Number: https://projectionlab.com/financial-terms/fi-number
- Coast FIRE: https://projectionlab.com/financial-terms/coast-fire
- Lean FIRE: https://projectionlab.com/financial-terms/lean-fire
- Barista FIRE: https://projectionlab.com/financial-terms/barista-fire
- Fat FIRE: https://projectionlab.com/financial-terms/fat-fire
- Chubby FIRE: https://projectionlab.com/financial-terms/chubby-fire
- Mullet FIRE: https://projectionlab.com/financial-terms/mullet-fire
- Savings Rate: https://projectionlab.com/financial-terms/savings-rate

## Withdrawal & Risk
- Safe Withdrawal Rate: https://projectionlab.com/financial-terms/safe-withdrawal-rate
- 4% Rule: https://projectionlab.com/financial-terms/4-percent-rule
- Withdrawal Rate: https://projectionlab.com/financial-terms/withdrawal-rate
- Sequence of Returns Risk: https://projectionlab.com/financial-terms/sequence-of-returns-risk
- Bucket Strategy: https://projectionlab.com/financial-terms/bucket-strategy
- Monte Carlo Simulation: https://projectionlab.com/financial-terms/monte-carlo-simulation

## ProjectionLab Help
- Creating Plans: https://projectionlab.com/help/create-new-plan
- Cash Flow Priorities: https://projectionlab.com/help/cash-flow-priorities
- Withdrawal Strategy Mode: https://projectionlab.com/help/withdrawal-strategy-mode
- Plan vs Chance of Success: https://projectionlab.com/help/plan-vs-chance-of-success
- Monte Carlo Trials: https://projectionlab.com/help/increase-trials-in-chance-of-success
- Investment Growth: https://projectionlab.com/help/model-investment-growth
- Getting Started: https://projectionlab.com/blog/getting-started-with-projectionlab
- Financial Scenarios: https://projectionlab.com/blog/financial-planning-scenarios
- Milestones: https://projectionlab.com/blog/milestones

## Plugin API
- API Docs: https://app.projectionlab.com/docs/
- PluginAPI Type: https://app.projectionlab.com/docs/types/PluginAPI.html
`;

export function registerKnowledgeResource(server: McpServer): void {
  server.resource(
    "projectionlab-knowledge",
    "projectionlab://knowledge",
    {
      description:
        "Curated index of ProjectionLab documentation URLs organized by topic. Reference these when users ask for more detail about FIRE concepts, withdrawal strategies, or ProjectionLab features.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "projectionlab://knowledge",
          mimeType: "text/markdown",
          text: KNOWLEDGE_BASE,
        },
      ],
    }),
  );
}
