import assert from 'node:assert/strict';
import { describeTutorialChanges, slugify, tutorialAccessPayload, tutorialPublicPath, youtubeId } from '../src/tutorialUtils.js';

const videoId = 'dQw4w9WgXcQ';

assert.equal(slugify('  Mi Tútorial / IA  '), 'mi-tutorial-ia');
assert.equal(tutorialPublicPath({ slug: 'Mi Tutorial', accessMode: 'public' }), '/hub/mi-tutorial');
assert.equal(tutorialPublicPath({ slug: 'Mi Tutorial', accessMode: 'email' }), '/acceso/mi-tutorial');

assert.equal(youtubeId(`https://www.youtube.com/watch?v=${videoId}&t=42`), videoId);
assert.equal(youtubeId(`https://youtu.be/${videoId}?si=abc`), videoId);
assert.equal(youtubeId(`https://www.youtube.com/embed/${videoId}`), videoId);
assert.equal(youtubeId(`https://www.youtube.com/shorts/${videoId}`), videoId);
assert.equal(youtubeId(`https://www.youtube-nocookie.com/embed/${videoId}`), videoId);
assert.equal(youtubeId(`https://evil.example/youtube.com/watch?v=${videoId}`), '');
assert.equal(youtubeId(`https://youtube.com.evil.example/watch?v=${videoId}`), '');
assert.equal(youtubeId(`http://youtube.com/watch?v=${videoId}`), '');
assert.equal(youtubeId('https://youtube.com/watch?v=demasiado-corto'), '');

assert.deepEqual(
  tutorialAccessPayload({ tutorialId: 'stable-id', slug: 'old-slug', name: 'Ada', email: 'ada@example.com', consent: true, website: '', ignored: true }),
  { tutorialId: 'stable-id', slug: 'old-slug', name: 'Ada', email: 'ada@example.com', consent: true, website: '' },
);

assert.deepEqual(
  describeTutorialChanges(
    { title: 'Antes', slug: 'antes', status: 'draft' },
    { title: 'Después', slug: 'despues', status: 'published' },
  ).map(change => change.field),
  ['title', 'slug', 'status'],
);

console.log('Tutorial utils: 14/14 pruebas aprobadas.');
