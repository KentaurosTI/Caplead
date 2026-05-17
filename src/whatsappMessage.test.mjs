import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KENTAUROS_WHATSAPP_BUSINESS,
  buildWhatsappMessage,
  buildWhatsappUrl,
  formatWhatsappBusinessContact,
  normalizeWhatsappPhone
} from './whatsappMessage.mjs';

test('normalizes Brazilian mobile numbers for wa.me links', () => {
  assert.equal(normalizeWhatsappPhone('(21) 99888-7777'), '5521998887777');
  assert.equal(normalizeWhatsappPhone('+55 21 99888-7777'), '5521998887777');
});

test('formats the Kentauros WhatsApp Business contact in the message', () => {
  assert.equal(KENTAUROS_WHATSAPP_BUSINESS, '11930186652');
  assert.equal(formatWhatsappBusinessContact(), '(11) 93018-6652');
});

test('builds a WhatsApp URL with the predefined consultative message', () => {
  const url = buildWhatsappUrl(
    { titulo: 'Clínica Recanto PSI', telefone: '(21) 99888-7777' },
    'Matheus'
  );

  assert.ok(url.startsWith('https://wa.me/5521998887777?text='));
  const message = decodeURIComponent(url.split('text=')[1]);
  assert.equal(message, buildWhatsappMessage({ titulo: 'Clínica Recanto PSI' }, 'Matheus'));
  assert.match(message, /soluções feitas em IA/);
  assert.match(message, /\(11\) 93018-6652/);
});
