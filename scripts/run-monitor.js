const https = require('https');
const fs = require('fs');
const path = require('path');

const COMPETITORS = [
  {
    name: 'Planview',
    slug: 'planview',
    domain: 'planview.com',
    tier: 1,
    checks: ['press', 'funding', 'compliance', 'reviews', 'jobs', 'pricing', 'product']
  }
  // Add more competitors here
];

const OUR_PRODUCT = `
Cora Systems — enterprise project and portfolio management (PPM) platform.
Primary buyer: PMO Directors and CIOs at organisations with 500–10,000 employees
in public sector, financial services, and regulated industries.
Differentiators: EVM, benefits tracking, programme governance, public sector compliance,
FedRAMP pursuit, faster implementation (6–8 weeks vs 6–9 months).
`;

function loadBaseline(slug) {
  const file = path.join('baselines', slug + '.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return { last_run: null, signals: {} };
}

function saveBaseline(slug, baseline) {
  const file = path.join('baselines', slug + '.json');
  fs.writeFileSync(file, JSON.stringify(baseline, null, 2));
}

function callAnthropic(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error.message);
          resolve(parsed.content[0].text);
        } catch (e) {
          reject(new Error('API error: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runMonitorForCompetitor(competitor) {
  console.log('\n🔍 Checking ' + competitor.name + '...');

  const baseline = loadBaseline(competitor.slug);
  const lastRun = baseline.last_run || 'never';

  const prompt = `You are a competitive intelligence analyst monitoring ${competitor.name} for Cora Systems.

OUR PRODUCT:
${OUR_PRODUCT}

COMPETITOR: ${competitor.name} (${competitor.domain})
LAST RUN: ${lastRun}
CHECKS TO RUN: ${competitor.checks.join(', ')}

Using your knowledge up to your training cutoff, check for any NEW or CHANGED signals since ${lastRun} across these categories:

1. PRESS & NEWS — New press releases, product announcements, partnerships
2. FUNDING & M&A — New funding rounds, acquisitions, leadership changes
3. COMPLIANCE & TRUST — New certifications, FedRAMP status, SOC 2 changes
4. REVIEW SIGNALS — New negative reviews mentioning pricing, support, or migration
5. JOB POSTING PATTERNS — New strategic roles signalling direction
6. PRICING SIGNALS — Changes to pricing tiers, free trial, starting price
7. PRODUCT SIGNALS — New features, changelog entries, roadmap announcements

For each signal found, score it:
🔴 HIGH — Requires immediate sales team awareness (new funding, FedRAMP cert, pricing change)
🟡 MEDIUM — Worth noting, monitor for follow-on (hiring surge, negative review cluster)
🟢 LOW — Informational only (minor blog post, small changelog entry)

Only include HIGH and MEDIUM signals in the digest. LOW signals note briefly at end.
If no HIGH/MEDIUM signals found, state: "No significant changes detected this week."

Format your response as a clean digest with:
- Run date: ${new Date().toISOString().split('T')[0]}
- Competitor: ${competitor.name}
- Signals found: [count] High | [count] Medium
- Then list each signal with score, description, date detected, and source
- End with: RECOMMENDED ACTIONS (one per High signal)

Label all claims as [Data], [Estimate], or [Inferred]. Never fabricate signals.`;

  const digest = await callAnthropic(prompt);

  const date = new Date().toISOString().split('T')[0];
  const filename = competitor.slug + '-monitor-' + date + '.md';
  fs.writeFileSync(path.join('outputs', filename), digest);
  console.log('✅ Digest saved: outputs/' + filename);

  saveBaseline(competitor.slug, { last_run: date, signals: { updated: date } });
  console.log('✅ Baseline updated for ' + competitor.name);

  return { competitor: competitor.name, file: filename, status: 'success' };
}

async function main() {
  console.log('🚀 Starting weekly competitor monitor run...');
  console.log('📅 Date: ' + new Date().toISOString().split('T')[0]);
  console.log('📋 Competitors: ' + COMPETITORS.map(c => c.name).join(', '));

  const results = [];

  for (const competitor of COMPETITORS) {
    try {
      const result = await runMonitorForCompetitor(competitor);
      results.push(result);
    } catch (error) {
      console.error('❌ Failed for ' + competitor.name + ':', error.message);
      results.push({ competitor: competitor.name, status: 'failed', error: error.message });
    }
  }

  console.log('\n📊 Run Summary:');
  results.forEach(r => {
    const icon = r.status === 'success' ? '✅' : '❌';
    console.log('  ' + icon + ' ' + r.competitor + ': ' + r.status);
  });

  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
