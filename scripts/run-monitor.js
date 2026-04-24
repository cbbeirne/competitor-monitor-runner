#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

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

const OUR_PRODUCT = `Cora Systems — enterprise project and portfolio management (PPM) platform.
Primary buyer: PMO Directors and CIOs at organisations with 500–10,000 employees
in public sector, financial services, and regulated industries.
Differentiators: EVM, benefits tracking, programme governance, public sector compliance,
FedRAMP pursuit, faster implementation (6–8 weeks vs 6–9 months).`;

function loadBaseline(slug) {
  const file = path.join('baselines', slug + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return { last_run: null };
}

function saveBaseline(slug, baseline) {
  if (!fs.existsSync('baselines')) fs.mkdirSync('baselines');
  fs.writeFileSync(path.join('baselines', slug + '.json'), JSON.stringify(baseline, null, 2));
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
        } catch (e) { reject(new Error('API error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildHTML(competitor, date, digest) {
  // Parse signal counts from digest text
  const highMatch = digest.match(/🔴[^\d]*(\d+)/);
  const medMatch = digest.match(/🟡[^\d]*(\d+)/);
  const highCount = highMatch ? highMatch[1] : '0';
  const medCount = medMatch ? medMatch[1] : '0';

  // Convert markdown-style sections to HTML
  const body = digest
    .replace(/^### (.+)$/gm, '<h4 style="color:#171340;font-size:13px;font-weight:700;margin:16px 0 8px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#171340;font-size:14px;font-weight:700;margin:20px 0 10px;border-bottom:1px solid #BBBDBF;padding-bottom:6px;">$1</h3>')
    .replace(/^🔴 (.+)$/gm, '<div style="background:#F9E5EF;border-left:3px solid #3B0338;border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:12px;"><strong>🔴 HIGH</strong> — $1</div>')
    .replace(/^🟡 (.+)$/gm, '<div style="background:#FFEEF6;border-left:3px solid #DF0062;border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:12px;"><strong>🟡 MEDIUM</strong> — $1</div>')
    .replace(/^🟢 (.+)$/gm, '<div style="background:#E5F4F3;border-left:3px solid #002A33;border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:12px;"><strong>🟢 LOW</strong> — $1</div>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;padding-left:12px;border-left:3px solid #DF0062;font-size:12px;">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="line-height:1.6;font-size:13px;color:#333333;margin-bottom:12px;">')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; color: #333333; background: #fff; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div style="background:#171340;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;">
    <div style="background:linear-gradient(180deg,#5957FF 0%,#DF0062 100%);width:6px;height:38px;margin-right:16px;border-radius:2px;"></div>
    <div>
      <div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">Competitive Monitor</div>
      <div style="color:#fff;font-size:18px;font-weight:700;margin-top:1px;">${competitor.name} — Weekly Signal Digest</div>
    </div>
  </div>
  <div style="text-align:right;">
    <div style="color:rgba(255,255,255,0.5);font-size:10px;">enterprise-competitor-monitor</div>
    <div style="color:#fff;font-size:13px;font-weight:600;margin-top:2px;">${date}</div>
  </div>
</div>
<div style="background:#F5F3F3;border-bottom:1px solid #BBBDBF;padding:10px 28px;display:flex;gap:28px;align-items:center;flex-wrap:wrap;">
  <div><span style="color:#BBBDBF;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Competitor</span><span style="margin-left:6px;font-weight:700;color:#171340;">${competitor.name}</span></div>
  <div><span style="color:#BBBDBF;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Signals</span><span style="margin-left:6px;font-weight:700;color:#3B0338;">🔴 ${highCount} High</span><span style="margin-left:8px;font-weight:700;color:#DF0062;">🟡 ${medCount} Medium</span></div>
  <div><span style="color:#BBBDBF;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Checks</span><span style="margin-left:6px;font-weight:700;color:#171340;">${competitor.checks.join(', ')}</span></div>
</div>
<div style="max-width:980px;margin:0 auto;padding:28px;">
  <p style="line-height:1.6;font-size:13px;color:#333333;margin-bottom:12px;">${body}</p>
</div>
<div style="background:#F5F3F3;border-top:1px solid #BBBDBF;padding:12px 28px;text-align:center;color:#BBBDBF;font-size:11px;margin-top:40px;">
  Cora Systems — Competitive Monitor | Generated ${date} | For internal use only
</div>
</body></html>`;
}

async function generatePDF(html, outputPath) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  await browser.close();
}

async function runMonitorForCompetitor(competitor) {
  console.log('\n🔍 Checking ' + competitor.name + '...');
  const baseline = loadBaseline(competitor.slug);
  const lastRun = baseline.last_run || 'never';
  const date = new Date().toISOString().split('T')[0];

  const prompt = `You are a competitive intelligence analyst monitoring ${competitor.name} for Cora Systems.

OUR PRODUCT: ${OUR_PRODUCT}

COMPETITOR: ${competitor.name} (${competitor.domain})
LAST RUN: ${lastRun}
TODAY: ${date}

Check for NEW or CHANGED signals since ${lastRun} across:
1. PRESS & NEWS — New press releases, product announcements, partnerships
2. FUNDING & M&A — New funding rounds, acquisitions, leadership changes
3. COMPLIANCE & TRUST — New certifications, FedRAMP status, SOC 2 changes
4. REVIEW SIGNALS — New negative reviews mentioning pricing, support, migration
5. JOB POSTING PATTERNS — New strategic roles signalling direction
6. PRICING SIGNALS — Changes to pricing tiers, free trial, starting price
7. PRODUCT SIGNALS — New features, changelog entries

Score each signal:
🔴 HIGH — Requires immediate sales team awareness
🟡 MEDIUM — Worth noting, monitor for follow-on
🟢 LOW — Informational only

Only include HIGH and MEDIUM signals in the digest.
If no HIGH/MEDIUM signals: state "No significant changes detected this week."

Format as:
## Run Summary
Run date: ${date} | Competitor: ${competitor.name} | Signals: 🔴 [N] High | 🟡 [N] Medium

## Signals

[list each signal with score, description, source]

## Recommended Actions
[one action per High signal]

Label claims [Data], [Estimate], or [Inferred]. Never fabricate signals.`;

  const digest = await callAnthropic(prompt);
  const html = buildHTML(competitor, date, digest);

  if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
  const pdfPath = path.join('outputs', competitor.slug + '-monitor-' + date + '.pdf');
  await generatePDF(html, pdfPath);
  console.log('✅ PDF saved: ' + pdfPath);

  saveBaseline(competitor.slug, { last_run: date });
  return { competitor: competitor.name, file: pdfPath, status: 'success' };
}

async function main() {
  console.log('🚀 Starting weekly competitor monitor...');
  console.log('📅 Date: ' + new Date().toISOString().split('T')[0]);

  const results = [];
  for (const competitor of COMPETITORS) {
    try {
      results.push(await runMonitorForCompetitor(competitor));
    } catch (error) {
      console.error('❌ Failed for ' + competitor.name + ':', error.message);
      results.push({ competitor: competitor.name, status: 'failed', error: error.message });
    }
  }

  console.log('\n📊 Run Summary:');
  results.forEach(r => console.log('  ' + (r.status === 'success' ? '✅' : '❌') + ' ' + r.competitor + ': ' + r.status));
  if (results.some(r => r.status === 'failed')) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
