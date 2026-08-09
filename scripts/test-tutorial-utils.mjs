import strict from 'node:assert/strict';
import { audienceLabel, changeImpact, changeValueLabel, describeTutorialChanges, formatTime, parseTimecode, slugify, tutorialAccessPayload, tutorialPublicPath, youtubeId } from '../src/tutorialUtils.js';

// El total se cuenta solo: un número escrito a mano en el resumen final ya se
// había desincronizado del archivo y anunciaba más pruebas de las que corren.
let checks = 0;
const assert = new Proxy(strict, { get: (target, name) => (...args) => { checks += 1; return target[name](...args); } });

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

// El panel escribe el inicio en formato YouTube y el hub lo vuelve a mostrar
// igual: formatTime y parseTimecode deben ser inversas exactas.
assert.equal(formatTime(0), '00:00');
assert.equal(formatTime(90), '01:30');
assert.equal(formatTime(3723), '1:02:03');
assert.equal(parseTimecode('00:00'), 0);
assert.equal(parseTimecode('01:30'), 90);
assert.equal(parseTimecode('1:30'), 90);
assert.equal(parseTimecode(' 1:02:03 '), 3723);
assert.equal(parseTimecode('90:00'), 5400);
assert.equal(parseTimecode('45'), 45);
assert.equal(parseTimecode(0), 0);
assert.equal(parseTimecode(120), 120);
assert.equal(parseTimecode('1:75'), null);
assert.equal(parseTimecode('1:2:3:4'), null);
assert.equal(parseTimecode('-30'), null);
assert.equal(parseTimecode('doce treinta'), null);
assert.equal(parseTimecode(''), null);
assert.equal(parseTimecode(null), null);
[0, 7, 59, 60, 90, 599, 3599, 3600, 3723, 36000].forEach(seconds => {
  assert.equal(parseTimecode(formatTime(seconds)), seconds, `ida y vuelta en ${seconds}s`);
});

// El diálogo de revisión se lee entero antes de publicar: ninguna variante
// puede quedar mal concordada ni hablar de “0 suscriptores”.
assert.equal(audienceLabel(0), '0 suscriptores');
assert.equal(audienceLabel(1), '1 suscriptor');
assert.equal(audienceLabel(12), '12 suscriptores');
assert.equal(changeValueLabel('status', 'draft'), 'Borrador');
assert.equal(changeValueLabel('accessMode', 'public'), 'Público, sin email');
assert.equal(changeValueLabel('coverUrl', '/images/flujo-classroom.webp'), 'imagen predeterminada');
assert.equal(changeValueLabel('slug', 'mi-ruta'), '«mi-ruta»');
assert.equal(changeValueLabel('title', ''), 'sin definir');

const unpublish = { field: 'status', to: 'draft' };
const requireEmail = { field: 'accessMode', to: 'email' };
const rename = { field: 'slug', to: 'nueva-ruta' };

[
  changeImpact(unpublish, { subscribers: 0 }),
  changeImpact(unpublish, { subscribers: 1 }),
  changeImpact(unpublish, { subscribers: 12 }),
  changeImpact(requireEmail, { subscribers: 0 }),
  changeImpact(requireEmail, { subscribers: 1 }),
  changeImpact(requireEmail, { subscribers: 12 }),
  changeImpact(rename, { subscribers: 0 }),
  changeImpact(rename, { subscribers: 1 }),
  changeImpact(rename, { subscribers: 12 }),
].forEach(sentence => {
  assert.ok(!/\b0 suscriptores\b/.test(sentence), `no debe mencionar cero suscriptores: ${sentence}`);
  assert.ok(!/\b1 suscriptor\b(?!es)/.test(sentence), `el singular no se cuenta en dígitos: ${sentence}`);
  assert.ok(!/1 suscriptor (dejarán|conservan)|los 1 /i.test(sentence), `concordancia rota: ${sentence}`);
  assert.ok(sentence.endsWith('.'), `debe cerrar la frase: ${sentence}`);
});

assert.match(changeImpact(unpublish, { subscribers: 0 }), /no encontrado/);
assert.match(changeImpact(unpublish, { subscribers: 1 }), /el suscriptor que ya tiene acceso dejará de abrir/);
assert.match(changeImpact(unpublish, { subscribers: 12 }), /los 12 suscriptores que ya tienen acceso dejarán de abrir/);
assert.equal(changeImpact(requireEmail, { subscribers: 0 }), 'El enlace directo al aula pedirá correo antes de mostrar los materiales.');
assert.match(changeImpact(requireEmail, { subscribers: 1 }), /El suscriptor con acceso concedido lo conserva\.$/);
assert.match(changeImpact(requireEmail, { subscribers: 12 }), /Los 12 suscriptores con acceso concedido lo conservan\.$/);
assert.match(changeImpact(rename, { subscribers: 0 }), /redirigido automáticamente\.$/);
assert.match(changeImpact(rename, { subscribers: 1 }), /incluido el suscriptor que ya la recibió\.$/);
assert.match(changeImpact(rename, { subscribers: 12 }), /incluidos los 12 suscriptores que ya la recibieron\.$/);
assert.match(changeImpact({ field: 'coverUrl' }, { replacesManagedCover: true }), /se eliminará de Storage/);
assert.match(changeImpact({ field: 'coverUrl' }, {}), /biblioteca y en la portada/);
assert.match(changeImpact({ field: 'youtubeUrl' }, {}), /marcas de tiempo/);

// Un fallo aborta el proceso, así que todo lo contado aquí pasó.
console.log(`Tutorial utils: ${checks} pruebas aprobadas.`);
