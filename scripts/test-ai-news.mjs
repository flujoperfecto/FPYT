import assert from 'node:assert/strict';
import {
  fetchFeed,
  filterAndDeduplicate,
  parseFeed,
  publishValidatedSelection,
  shortlistCandidates,
  validateModelSelection,
  withAbortTimeout,
} from '../supabase/functions/refresh-ai-news/news.ts';

const source = { id: 'test', name: 'Fuente', url: 'https://example.com/feed', kind: 'official' };
const rss = `<rss><channel><item><title><![CDATA[Nueva herramienta para agentes]]></title><link>https://example.com/a?utm_source=x</link><pubDate>Wed, 05 Aug 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Resumen breve.</p>]]></description></item></channel></rss>`;
const atom = `<feed><entry><title>Modelo abierto actualizado</title><link rel="alternate" href="https://example.com/b"/><updated>2026-08-05T09:00:00Z</updated><summary>Otra síntesis.</summary></entry></feed>`;
const parsed = [...parseFeed(rss, source), ...parseFeed(atom, source)];
assert.equal(parsed.length, 2);
assert.equal(parsed[0].url, 'https://example.com/a');
assert.equal(parsed[0].summary, 'Resumen breve.');

const now = new Date('2026-08-05T12:00:00Z');
const base = { sourceId: 'test', sourceName: 'Fuente', sourceKind: 'official', summary: 'Resumen', publishedAt: '2026-08-05T10:00:00Z' };
const unique = filterAndDeduplicate([
  { ...base, title: 'Noticia uno', url: 'https://example.com/one' },
  { ...base, title: 'Noticia uno', url: 'https://example.com/other' },
  { ...base, title: 'Noticia dos', url: 'https://example.com/two' },
], new Date('2026-08-04T00:00:00Z'), now, [{ headline: 'Anterior', primary_source_url: 'https://example.com/two' }]);
assert.equal(unique.length, 1);

function candidate(index) {
  return {
    id: `news_${index}`,
    sourceId: `source_${index}`,
    sourceName: `Fuente ${index}`,
    sourceKind: index % 2 ? 'official' : 'media',
    title: `Candidate title ${index}`,
    summary: 'A useful source summary that is not copied in full.',
    url: `https://example.com/${index}`,
    publishedAt: `2026-08-05T0${index}:00:00Z`,
  };
}

const candidates = [candidate(1), candidate(2), candidate(3), candidate(4)];
const selection = { items: candidates.map((item, index) => ({
  candidateId: item.id,
  supportingCandidateIds: [],
  category: index < 2 ? 'herramientas' : 'agentes',
  headline: `Titular práctico número ${index + 1}`,
  summary: 'Este es un resumen en español suficientemente largo para pasar la validación del contrato.',
  whyItMatters: 'Importa porque permite tomar una decisión práctica con mejor contexto.',
})) };
assert.equal(validateModelSelection(selection, candidates).length, 4);
assert.throws(() => validateModelSelection({ items: [] }, candidates), /model_must_select_four/);

await assert.rejects(
  fetchFeed(source, async () => new Response('oversized', { status: 200, headers: { 'content-length': '1001' } }), 100, 1_000),
  /feed_too_large/,
);
const stalled = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
await assert.rejects(fetchFeed(source, stalled, 5));

let publications = 0;
await assert.rejects(publishValidatedSelection({ items: [] }, candidates, async () => { publications += 1; }));
assert.equal(publications, 0);

await assert.rejects(
  withAbortTimeout(signal => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }), 5, 'deepseek_timeout'),
  /deepseek_timeout/,
);

const diverseShortlist = shortlistCandidates([
  ...Array.from({ length: 8 }, (_, index) => ({ ...base, sourceId: 'repeated', title: `Repeated ${index}`, url: `https://example.com/repeated-${index}` })),
  { ...base, sourceId: 'second', title: 'Second source', url: 'https://example.com/second' },
  { ...base, sourceId: 'third', title: 'Third source', url: 'https://example.com/third' },
], 4);
assert.equal(diverseShortlist.length, 4);
assert.deepEqual(diverseShortlist.slice(0, 3).map(item => item.sourceId), ['repeated', 'second', 'third']);

console.log('Pulso IA function tests: 9/9 OK');
