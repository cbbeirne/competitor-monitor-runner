# Competitor Monitor Runner

Weekly automated competitor monitoring for Cora Systems, powered by Claude.

## Schedule
Runs automatically every **Monday at 07:00 UTC**.
Can also be triggered manually via GitHub Actions → Run workflow.

## Outputs
Digests are saved to `outputs/` as markdown files:
`{competitor-slug}-monitor-{YYYY-MM-DD}.md`

Baselines are saved to `baselines/` as JSON files and committed back automatically.

## Adding Competitors
Edit `scripts/run-monitor.js` and add to the `COMPETITORS` array:
```js
{
  name: 'Competitor Name',
  slug: 'competitor-slug',
  domain: 'competitordomain.com',
  tier: 1,
  checks: ['press', 'funding', 'compliance', 'reviews', 'jobs', 'pricing', 'product']
}
```

## Secrets Required
- `ANTHROPIC_API_KEY` — from console.anthropic.com

## Setup
1. Add `ANTHROPIC_API_KEY` to GitHub repo Secrets
2. Enable GitHub Actions
3. Push to main branch
4. To run immediately: Actions → Competitor Monitor — Weekly Run → Run workflow
