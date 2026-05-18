import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsappMessage,
  buildWhatsappUrl,
  normalizeWhatsappPhone
} from './whatsappMessage.mjs';

test('normalizes Brazilian mobile numbers for wa.me links', () => {
  assert.equal(normalizeWhatsappPhone('(21) 99888-7777'), '5521998887777');
  assert.equal(normalizeWhatsappPhone('+55 21 99888-7777'), '5521998887777');
});

test('builds a WhatsApp URL with the predefined consultative message', () => {
  const url = buildWhatsappUrl(
    { titulo: 'Centro da Pele', telefone: '(21) 99888-7777' },
    'Matheus'
  );

  assert.ok(url.startsWith('https://wa.me/5521998887777?text='));
  const message = decodeURIComponent(url.split('text=')[1]);
  assert.equal(message, buildWhatsappMessage({ titulo: 'Centro da Pele' }, 'Matheus'));
  assert.equal(message, [
    'Olá, tudo bem? Aqui é o Matheus, da Kentauros.',
    'Faço parte de uma consultoria de soluções tecnológicas focada em analisar sites e sistemas para identificar melhorias de usabilidade, conversão e eficiência digital.',
    'Analisei rapidamente o site da Centro da Pele e encontrei algumas oportunidades que podem melhorar a experiência do usuário e facilitar a geração de novos contatos.',
    'Posso te enviar um diagnóstico rápido com os principais pontos que observei?'
  ].join('\n\n'));
});
