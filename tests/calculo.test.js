import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intervalo, calcularTurno, horasNocturnas,
  estimarNomina, periodosDelMes, filtrarPeriodo, horasDelAnio, validarTurno,
} from '../www/calculo.js';

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

const AJ = {
  precioBase: 9.54, precioExtra: 9.54, precioNocturna: 0.48,
  descuentosPct: 6.5, irpfPct: 0, limiteAnual: 896,
};

test('estimarNomina: 4 h asignadas, 3 h extra y 1 h nocturna', () => {
  // Real 16:00-23:00 sobre 16:00-20:00 → 3 h extra y 1 h entre 22:00 y 23:00.
  const e = estimarNomina([turno('16:00', '20:00', '16:00', '23:00')], AJ);
  assert.equal(e.horasAsignadas, 4);
  assert.equal(e.horasExtra, 3);
  assert.equal(e.horasNocturnas, 1);
  assert.equal(e.base, 38.16);        // 4 × 9,54
  assert.equal(e.extra, 28.62);       // 3 × 9,54
  assert.equal(e.nocturnidad, 0.48);  // 1 × 0,48
  assert.equal(e.bruto, 67.26);
  assert.equal(e.descuentos, 4.37);   // 6,5 % de 67,26 = 4,3719
  assert.equal(e.irpf, 0);
  assert.equal(e.liquido, 62.89);
});

test('estimarNomina: nocturnidad como en la nómina, 5,95 h × 0,48 = 2,86', () => {
  // La nómina de octubre muestra 2,84 porque redondea el precio; aquí es la cuenta exacta.
  const e = estimarNomina([], { ...AJ });
  assert.equal(e.bruto, 0);
  assert.equal(Math.round(5.95 * 0.48 * 100) / 100, 2.86);
});

test('estimarNomina: sin turnos todo es cero', () => {
  const e = estimarNomina([], AJ);
  assert.equal(e.liquido, 0);
  assert.equal(e.horasAsignadas, 0);
});

test('estimarNomina: aplica el IRPF si se configura', () => {
  const e = estimarNomina([turno('16:00', '20:00', '16:00', '20:00')], { ...AJ, irpfPct: 2 });
  assert.equal(e.bruto, 38.16);
  assert.equal(e.irpf, 0.76); // 2 % de 38,16 = 0,7632
});

test('periodosDelMes: octubre y febrero', () => {
  const oct = periodosDelMes(2026, 10);
  assert.deepEqual(oct.mes, { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(oct.q1, { desde: '2026-10-01', hasta: '2026-10-15' });
  assert.deepEqual(oct.q2, { desde: '2026-10-16', hasta: '2026-10-31' });
  assert.equal(periodosDelMes(2026, 2).mes.hasta, '2026-02-28');
});

test('filtrarPeriodo: incluye los extremos', () => {
  const a = { ...turno('16:00', '20:00', '16:00', '20:00', '2026-10-01') };
  const b = { ...turno('16:00', '20:00', '16:00', '20:00', '2026-10-15') };
  const c = { ...turno('16:00', '20:00', '16:00', '20:00', '2026-10-16') };
  assert.deepEqual(filtrarPeriodo([a, b, c], '2026-10-01', '2026-10-15'), [a, b]);
});

test('horasDelAnio: solo cuenta las horas trabajadas de ese año', () => {
  const t26 = turno('16:00', '20:00', '16:00', '21:00', '2026-10-05');
  const t25 = turno('16:00', '20:00', '16:00', '20:00', '2025-12-31');
  assert.equal(horasDelAnio([t26, t25], 2026), 5);
});

test('validarTurno: faltan datos', () => {
  const v = validarTurno({ fecha: '', asignadoEntrada: '16:00' });
  assert.ok(v.errores.includes('Falta la fecha.'));
  assert.ok(v.errores.includes('Falta la salida asignada.'));
  assert.ok(v.errores.includes('Falta la entrada real.'));
});

test('validarTurno: entrada y salida iguales es un error', () => {
  const v = validarTurno(turno('16:00', '16:00', '16:00', '20:00'));
  assert.deepEqual(v.errores, ['La entrada y la salida asignadas son iguales.']);
});

test('validarTurno: un turno de más de 12 h da un aviso, no un error', () => {
  const v = validarTurno(turno('08:00', '16:00', '08:00', '07:00'));
  assert.equal(v.errores.length, 0);
  assert.equal(v.avisos.length, 1);
});

test('validarTurno: turno correcto no avisa de nada', () => {
  const v = validarTurno(turno('16:00', '20:00', '16:00', '20:00'));
  assert.deepEqual(v, { errores: [], avisos: [] });
});
