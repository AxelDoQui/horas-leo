import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intervalo, calcularTurno, horasNocturnas, detallarTurnos,
  sumarDias, semanaDe, rejillaMes, topeDeFecha, validarJornadas, diasEntre,
  estimarNomina, periodosDelMes, filtrarPeriodo, horasDelAnio, validarTurno,
  cruzaMedianoche, tramosSolapan, periodosCierre, periodoCierreDe, validarCierres,
} from '../www/calculo.js';

const turno = (ae, as, re, rs, fecha = '2026-10-05') => ({
  fecha, asignadoEntrada: ae, asignadoSalida: as, realEntrada: re, realSalida: rs,
});
// Turno de 8 h cumplido tal cual, en la fecha dada.
const ocho = (fecha) => turno('10:00', '18:00', '10:00', '18:00', fecha);

test('intervalo: turno normal dura lo que dice', () => {
  const iv = intervalo('2026-10-05', '16:00', '20:00');
  assert.equal(iv.fin - iv.ini, 4 * 3600000);
});

test('intervalo: si la salida es anterior cruza la medianoche', () => {
  const iv = intervalo('2026-10-05', '22:00', '06:00');
  assert.equal(iv.fin - iv.ini, 8 * 3600000);
});

test('turno cumplido tal cual: sin diferencia ni nocturnas', () => {
  const c = calcularTurno(turno('16:00', '20:00', '16:00', '20:00'));
  assert.deepEqual(c, { asignadas: 4, trabajadas: 4, nocturnas: 0, diferencia: 0 });
});

test('se queda 1,5 h más de lo asignado: trabaja 5,5 h y la diferencia es +1,5', () => {
  const c = calcularTurno(turno('16:00', '20:00', '16:00', '21:30'));
  assert.equal(c.trabajadas, 5.5);
  assert.equal(c.diferencia, 1.5);
});

test('trabaja menos de lo asignado: la diferencia es negativa', () => {
  const c = calcularTurno(turno('16:00', '20:00', '17:00', '19:00'));
  assert.equal(c.trabajadas, 2);
  assert.equal(c.diferencia, -2);
});

test('turno de noche 22:00-06:00: 8 h, todas nocturnas', () => {
  const c = calcularTurno(turno('22:00', '06:00', '22:00', '06:00'));
  assert.equal(c.asignadas, 8);
  assert.equal(c.nocturnas, 8);
});

test('noche con más horas: real 21:00-06:30 → 9,5 trabajadas y 8,5 nocturnas', () => {
  const c = calcularTurno(turno('22:00', '06:00', '21:00', '06:30'));
  assert.equal(c.trabajadas, 9.5);
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

// ---- Tope semanal (lunes a domingo) ----
// 2026-10-05 es lunes.

test('detallarTurnos: dentro del tope no hay extra', () => {
  const ts = [ocho('2026-10-05'), ocho('2026-10-06'), ocho('2026-10-07')]; // 24 h
  const d = detallarTurnos(ts, 25);
  for (const t of ts) {
    assert.equal(d.get(t).extra, 0);
    assert.equal(d.get(t).ordinarias, 8);
  }
});

test('detallarTurnos: el turno que cruza el tope cuenta como extra solo lo que pasa', () => {
  const ts = [ocho('2026-10-05'), ocho('2026-10-06'), ocho('2026-10-07'), ocho('2026-10-08')];
  const d = detallarTurnos(ts, 25); // acumulado 8, 16, 24, 32 → el jueves pasa 7 h
  assert.equal(d.get(ts[2]).extra, 0);
  assert.equal(d.get(ts[3]).extra, 7);
  assert.equal(d.get(ts[3]).ordinarias, 1);
});

test('detallarTurnos: lo posterior al tope es todo extra, aunque esté dentro del turno asignado', () => {
  const ts = [ocho('2026-10-05'), ocho('2026-10-06'), ocho('2026-10-07'), ocho('2026-10-08'), ocho('2026-10-09')];
  const d = detallarTurnos(ts, 25);
  assert.equal(d.get(ts[4]).extra, 8);
  assert.equal(d.get(ts[4]).ordinarias, 0);
});

test('detallarTurnos: el domingo cuenta en la semana que acaba y el lunes empieza otra', () => {
  const ts = [
    ocho('2026-10-05'), ocho('2026-10-06'), ocho('2026-10-07'), ocho('2026-10-08'),
    turno('10:00', '14:00', '10:00', '14:00', '2026-10-11'), // domingo, 4 h → acumulado 36
    ocho('2026-10-12'),                                     // lunes siguiente: semana nueva
  ];
  const d = detallarTurnos(ts, 25);
  assert.equal(d.get(ts[4]).extra, 4);
  assert.equal(d.get(ts[5]).extra, 0);
});

test('detallarTurnos: no depende del orden en que vengan los turnos', () => {
  const ts = [ocho('2026-10-05'), ocho('2026-10-06'), ocho('2026-10-07'), ocho('2026-10-08')];
  const d = detallarTurnos(ts.slice().reverse(), 25);
  assert.equal(d.get(ts[3]).extra, 7);
  assert.equal(d.get(ts[0]).extra, 0);
});

test('detallarTurnos: una semana que cruza de mes se cuenta entera', () => {
  // Lunes 28/09 a jueves 01/10: 8 h cada día.
  const ts = [ocho('2026-09-28'), ocho('2026-09-29'), ocho('2026-09-30'), ocho('2026-10-01')];
  const d = detallarTurnos(ts, 25);
  assert.equal(d.get(ts[3]).extra, 7);
});

// ---- Fechas, semana y calendario ----

test('sumarDias: cruza mes y año', () => {
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2026-10-05', -7), '2026-09-28');
});

test('diasEntre: cuenta días de calendario, también entre meses y en negativo', () => {
  assert.equal(diasEntre('2026-10-01', '2026-10-15'), 14);
  assert.equal(diasEntre('2026-10-25', '2026-10-25'), 0);
  assert.equal(diasEntre('2026-10-30', '2026-11-02'), 3);
  assert.equal(diasEntre('2026-10-15', '2026-10-01'), -14);
});

test('semanaDe: de lunes a domingo, también si la fecha es domingo', () => {
  const sem = { desde: '2026-10-05', hasta: '2026-10-11' };
  assert.deepEqual(semanaDe('2026-10-05'), sem); // lunes
  assert.deepEqual(semanaDe('2026-10-08'), sem); // jueves
  assert.deepEqual(semanaDe('2026-10-11'), sem); // domingo
  assert.deepEqual(semanaDe('2026-10-12'), { desde: '2026-10-12', hasta: '2026-10-18' });
});

test('rejillaMes: octubre de 2026 empieza en jueves y rellena hasta completar semanas', () => {
  const c = rejillaMes(2026, 10);
  assert.equal(c.length % 7, 0);
  assert.equal(c.length, 35);
  assert.deepEqual(c.slice(0, 3), [null, null, null]);
  assert.equal(c[3], '2026-10-01');
  assert.equal(c[33], '2026-10-31');
  assert.equal(c[34], null);
});

test('rejillaMes: un mes que empieza en lunes no tiene huecos delante', () => {
  const c = rejillaMes(2026, 6); // 1 de junio de 2026 es lunes
  assert.equal(c[0], '2026-06-01');
});

// ---- Cambio de jornada (20 h hasta el 18/10/2026, 25 h desde el 19/10/2026) ----

const JORNADAS = [
  { desde: '2026-10-02', horas: 20 },
  { desde: '2026-10-19', horas: 25 },
];

test('topeDeFecha: usa la jornada vigente en la fecha', () => {
  assert.equal(topeDeFecha('2026-10-18', JORNADAS), 20);
  assert.equal(topeDeFecha('2026-10-19', JORNADAS), 25);
  assert.equal(topeDeFecha('2026-11-30', JORNADAS), 25);
  assert.equal(topeDeFecha('2026-09-01', JORNADAS), 20); // antes del primero: vale el primero
  assert.equal(topeDeFecha('2026-10-19', 30), 30);       // número fijo
});

test('detallarTurnos: la semana del 12 al 18 de octubre usa 20 h y la del 19 al 25 usa 25 h', () => {
  const sem1 = [ocho('2026-10-12'), ocho('2026-10-13'), ocho('2026-10-14')]; // 24 h con tope 20
  const sem2 = [ocho('2026-10-19'), ocho('2026-10-20'), ocho('2026-10-21')]; // 24 h con tope 25
  const d = detallarTurnos([...sem1, ...sem2], JORNADAS);
  assert.equal(d.get(sem1[2]).extra, 4);
  assert.equal(d.get(sem2[2]).extra, 0);
});

test('estimarNomina usa la lista de jornadas de los ajustes', () => {
  const ts = [ocho('2026-10-12'), ocho('2026-10-13'), ocho('2026-10-14')];
  const e = estimarNomina(ts, { ...AJ, jornadas: JORNADAS });
  assert.equal(e.horasExtra, 4);
  assert.equal(e.horasOrdinarias, 20);
});

test('validarJornadas: acepta una lista correcta y rechaza las malas', () => {
  assert.equal(validarJornadas(JORNADAS), '');
  assert.match(validarJornadas([]), /al menos una/);
  assert.match(validarJornadas([{ desde: '', horas: 20 }]), /fecha/);
  assert.match(validarJornadas([{ desde: '2026-10-02', horas: 0 }]), /más de 0/);
  assert.match(validarJornadas([{ desde: '2026-10-02', horas: 20 }, { desde: '2026-10-02', horas: 25 }]), /misma fecha/);
});

// ---- Nómina ----

const AJ = {
  precioBase: 9.54, precioExtra: 9.54, precioNocturna: 0.48,
  descuentosPct: 6.5, irpfPct: 0, limiteAnual: 896, topeSemanal: 25,
};

test('estimarNomina: 7 h trabajadas con 1 h nocturna, dentro del tope', () => {
  // Real 16:00-23:00: 7 h, 1 h entre 22:00 y 23:00. Con tope 25 no hay extra.
  const e = estimarNomina([turno('16:00', '20:00', '16:00', '23:00')], AJ);
  assert.equal(e.horasAsignadas, 4);
  assert.equal(e.horasOrdinarias, 7);
  assert.equal(e.horasExtra, 0);
  assert.equal(e.horasNocturnas, 1);
  assert.equal(e.base, 66.78);        // 7 × 9,54
  assert.equal(e.extra, 0);
  assert.equal(e.nocturnidad, 0.48);  // 1 × 0,48
  assert.equal(e.bruto, 67.26);
  assert.equal(e.descuentos, 4.37);   // 6,5 % de 67,26 = 4,3719
  assert.equal(e.irpf, 0);
  assert.equal(e.liquido, 62.89);
});

test('estimarNomina: con tope de 5 h, 2 de las 7 h son extra', () => {
  const e = estimarNomina([turno('16:00', '20:00', '16:00', '23:00')], { ...AJ, topeSemanal: 5 });
  assert.equal(e.horasOrdinarias, 5);
  assert.equal(e.horasExtra, 2);
  assert.equal(e.base, 47.7);   // 5 × 9,54
  assert.equal(e.extra, 19.08); // 2 × 9,54
  assert.equal(e.bruto, 67.26);
});

test('estimarNomina: la semana se cuenta con todos los turnos, no solo los del periodo', () => {
  // Semana lun 28/09 a jue 01/10. El periodo del mes de octubre solo incluye el jueves,
  // pero las 24 h anteriores ya gastaron el tope: ese día son 7 h extra.
  const todos = [ocho('2026-09-28'), ocho('2026-09-29'), ocho('2026-09-30'), ocho('2026-10-01')];
  const periodo = filtrarPeriodo(todos, '2026-10-01', '2026-10-31');
  const e = estimarNomina(periodo, AJ, todos);
  assert.equal(e.horasExtra, 7);
  assert.equal(e.horasOrdinarias, 1);
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

test('cruzaMedianoche: salida igual o anterior a la entrada acaba al día siguiente', () => {
  assert.equal(cruzaMedianoche('22:00', '02:00'), true);
  assert.equal(cruzaMedianoche('14:00', '22:00'), false);
  assert.equal(cruzaMedianoche('22:00', '22:00'), true);
});

test('turno de noche que sale a las 2: 4 h trabajadas, todas nocturnas', () => {
  const c = calcularTurno({ fecha: '2026-10-09', asignadoEntrada: '22:00', asignadoSalida: '02:00', realEntrada: '22:00', realSalida: '02:00' });
  assert.equal(c.trabajadas, 4);
  assert.equal(c.nocturnas, 4);
});

test('tramosSolapan: turno partido correcto no solapa, el solapado sí', () => {
  const a = { fecha: '2026-10-09', realEntrada: '09:00', realSalida: '13:00', asignadoEntrada: '09:00', asignadoSalida: '13:00' };
  const b = { fecha: '2026-10-09', realEntrada: '17:00', realSalida: '21:00', asignadoEntrada: '17:00', asignadoSalida: '21:00' };
  assert.equal(tramosSolapan(a, b), false);
  assert.equal(tramosSolapan(a, { ...b, realEntrada: '12:00' }), true);
  assert.equal(tramosSolapan(a, { ...b, asignadoEntrada: '12:30' }), true);
});

const INICIOS = ['2026-11-23', '2026-09-21', '2026-10-26', '2026-10-26'];

test('periodosCierre ordena, quita repetidos y cada periodo acaba el domingo antes del siguiente', () => {
  const p = periodosCierre(INICIOS);
  assert.deepEqual(p, [
    { desde: '2026-09-21', hasta: '2026-10-25', semanas: 5 },
    { desde: '2026-10-26', hasta: '2026-11-22', semanas: 4 },
    { desde: '2026-11-23', hasta: '2026-12-20', semanas: 4 }, // el último se supone de 4 semanas
  ]);
});

test('periodoCierreDe encuentra el periodo de una fecha, incluidos los bordes', () => {
  const p = periodosCierre(INICIOS);
  assert.equal(periodoCierreDe('2026-11-22', p).desde, '2026-10-26');
  assert.equal(periodoCierreDe('2026-11-23', p).desde, '2026-11-23');
  assert.equal(periodoCierreDe('2026-10-26', p).desde, '2026-10-26');
  assert.equal(periodoCierreDe('2026-01-01', p), null);
  assert.equal(periodoCierreDe('2026-12-21', p), null);
});

test('un periodo de cierre nunca parte una semana: las extra de la semana quedan enteras', () => {
  const t = (fecha) => ({ fecha, asignadoEntrada: '09:00', asignadoSalida: '14:00', realEntrada: '09:00', realSalida: '14:00' });
  const todos = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']; // 25 h hasta el domingo
  const det = detallarTurnos(todos.map(t), 25);
  assert.equal([...det.values()].reduce((a, x) => a + x.extra, 0), 0);
  const p = periodosCierre(INICIOS);
  assert.equal(semanaDe(p[1].desde).desde, p[1].desde); // empieza en lunes
  assert.equal(semanaDe(p[1].hasta).hasta, p[1].hasta); // acaba en domingo
});

test('validarCierres pide fechas válidas y que sean lunes', () => {
  assert.equal(validarCierres(INICIOS), '');
  assert.match(validarCierres(['2026-10-27']), /lunes/);
  assert.match(validarCierres(['mañana']), /fecha/);
  assert.match(validarCierres([]), /al menos/);
});
