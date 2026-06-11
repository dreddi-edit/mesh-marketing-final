#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const projectId = process.env.GCP_PROJECT_ID || 'mesh-494913';
const location = process.env.DISCOVERY_LOCATION || 'global';
const collection = process.env.DISCOVERY_COLLECTION || 'default_collection';
const engineId = process.env.DISCOVERY_ENGINE_ID || 'mesh-docs-search';

const defaultQueries = [
  'install Mesh CLI',
  'MCP server Claude Cursor',
  'Gateway API capsules',
  'voice mode doctor',
  'telemetry configuration'
];

const queries = process.argv.includes('--query')
  ? [process.argv[process.argv.indexOf('--query') + 1]].filter(Boolean)
  : defaultQueries;

function accessToken() {
  return execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function firstTitle(result) {
  const doc = result?.document || {};
  return doc.derivedStructData?.title || doc.structData?.title || doc.id || 'untitled';
}

function firstLink(result) {
  const doc = result?.document || {};
  return doc.derivedStructData?.link || doc.structData?.uri || doc.name || '';
}

async function search(query, token) {
  const url = `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/${location}/collections/${collection}/engines/${engineId}/servingConfigs/default_search:search`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': projectId
    },
    body: JSON.stringify({
      query,
      pageSize: 3,
      contentSearchSpec: {
        snippetSpec: { returnSnippet: true },
        summarySpec: { summaryResultCount: 3, includeCitations: true }
      }
    })
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json();
}

const token = accessToken();
let totalResults = 0;

for (const query of queries) {
  const payload = await search(query, token);
  const results = payload.results || [];
  totalResults += results.length;
  const top = results[0];
  const skipped = payload.summary?.summarySkippedReasons?.join(', ') || 'none';

  console.log(`\nquery: ${query}`);
  console.log(`results: ${results.length}`);
  console.log(`summarySkipped: ${skipped}`);
  if (top) {
    console.log(`top: ${firstTitle(top)}`);
    console.log(`link: ${firstLink(top)}`);
  }
}

if (totalResults === 0) {
  console.log('\nindexStatus: no results yet. Check domain verification / crawl status.');
} else {
  console.log(`\nindexStatus: ok (${totalResults} total returned results)`);
}
