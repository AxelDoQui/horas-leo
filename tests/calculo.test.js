import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalo, calcularTurno, horasNocturnas } from '../www/calculo.js';

const turno = (ae, as, re, rs, fecha = '2026-10-05') => ({
  fecha, asignadoEntrada: ae, asignadoSalida: as, realEntrada: re, realSalida: rs,
});

test('intervalo: turno normal dura lo que dice', () => {
  const iv = intervalo('2026-10-05', '16:00', '20:00');
  assert.equal(iv.fin - iv.ini, 4 * 3600000);
});

test('intervalo: si la salida es anterior cruza la medianoche', () => {
  const iv = intervalo('2026-10-05', '22:00', '06:00');
  assert.equal(iv.fin - iv.ini, 8 * 3600000);
});

test('turno cumplido tal cual: sin extra ni diferencia', () => {
  const c = calcularTurno(turno('16:00', '20:00', '16:00', '20:00'));
  assert.deepEqual(c, { asignadas: 4, trabajadas: 4, extra: 0, nocturnas: 0, diferencia: 0 });
});

test('se queda 1,5 h después de la salida asignada: 1,5 h extra', () => {
  const c = calcularTurno(turno('16:00', '20:00', '16:00', '21:30'));
  assert.equal(c.extra, 1.5);
  assert.equal(c.diferencia, 1.5);
});

test('entra 30 min antes de lo asignado: 0,5 h extra', () => {
  const c = calcularTurno(turno('16:00', '20:00', '15:30', '20:00'));
  assert.equal(c.extra, 0.5);
});

test('extra por los dos lados: 15-21 con turno 16-20 son 2 h extra', () => {
  const c = calcularTurno(turno('16:00', '20:00', '15:00', '21:00'));
  assert.equal(c.extra, 2);
  assert.equal(c.trabajadas, 6);
});

test('trabaja menos de lo asignado: no hay extra y la diferencia es negativa', () => {
  const c = calcularTurno(turno('16:00', '20:00', '17:00', '19:00'));
  assert.equal(c.extra, 0);
  assert.equal(c.diferencia, -2);
});

test('turno de noche 22:00-06:00: 8 h, todas nocturnas', () => {
  const c = calcularTurno(turno('22:00', '06:00', '22:00', '06:00'));
  assert.equal(c.asignadas, 8);
  assert.equal(c.nocturnas, 8);
  assert.equal(c.extra, 0);
});

test('noche con extra: real 21:00-06:30 sobre 22:00-06:00 → 1,5 extra y 8,5 nocturnas', () => {
  const c = calcularTurno(turno('22:00', '06:00', '21:00', '06:30'));
  assert.equal(c.extra, 1.5);
  assert.equal(c.nocturnas, 8.5);
});

test('nocturnas: 20:00-23:00 tiene 1 h nocturna', () => {
  const iv = intervalo('2026-10-05', '20:00', '23:00');
  assert.equal(horasNocturnas(iv), 1);
});

test('nocturnas: 05:00-09:00 tiene 2 h nocturnas (hasta las 07:00)', () => {
  const iv = intervalo('2026-10-05', '05:00', '09:00');
  assert.equal(horasNocturnas(iv), 2);
});

test('nocturnas: turno de tarde 14:00-22:00 no tiene ninguna', () => {
  const iv = intervalo('2026-10-05', '14:00', '22:00');
  assert.equal(horasNocturnas(iv), 0);
});
