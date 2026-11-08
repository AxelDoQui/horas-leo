// Lógica de cálculo de horas. Sin pantalla ni navegador: se prueba con node --test.
// Las horas se tratan como «hora de reloj» (Date.UTC), así que el cambio de hora
// de verano no altera la duración de un turno.

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export function redondear(n, dec = 2) {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function aMs(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return Date.UTC(a, m - 1, d, h, mi);
}

// Si la salida no es posterior a la entrada, el turno acaba al día siguiente.
export function intervalo(fecha, entrada, salida) {
  const ini = aMs(fecha, entrada);
  let fin = aMs(fecha, salida);
  if (fin <= ini) fin += DIA;
  return { ini, fin };
}

function solape(a, b) {
  return Math.max(0, Math.min(a.fin, b.fin) - Math.max(a.ini, b.ini));
}

// Horas del intervalo que caen entre las 22:00 y las 07:00 del día siguiente.
export function horasNocturnas(iv) {
  let total = 0;
  const medianoche = Math.floor(iv.ini / DIA) * DIA;
  for (let d = medianoche - DIA; d <= iv.fin; d += DIA) {
    total += solape(iv, { ini: d + 22 * HORA, fin: d + DIA + 7 * HORA });
  }
  return total / HORA;
}

// Limitación conocida: asignado y real se anclan a la misma fecha. Si el turno
// asignado cruza la medianoche y el real empieza ya pasada la medianoche
// (llega tarde, p. ej. a la 01:00), no se detecta el solape.
export function calcularTurno(t) {
  const asig = intervalo(t.fecha, t.asignadoEntrada, t.asignadoSalida);
  const real = intervalo(t.fecha, t.realEntrada, t.realSalida);
  const asignadas = (asig.fin - asig.ini) / HORA;
  const trabajadas = (real.fin - real.ini) / HORA;
  const extra = trabajadas - solape(real, asig) / HORA;
  return {
    asignadas: redondear(asignadas),
    trabajadas: redondear(trabajadas),
    extra: redondear(extra),
    nocturnas: redondear(horasNocturnas(real)),
    diferencia: redondear(trabajadas - asignadas),
  };
}

// ---- Estimación de nómina ----

export function estimarNomina(turnos, ajustes) {
  let asignadas = 0;
  let extra = 0;
  let nocturnas = 0;
  for (const t of turnos) {
    const c = calcularTurno(t);
    asignadas += c.asignadas;
    extra += c.extra;
    nocturnas += c.nocturnas;
  }
  const base = asignadas * ajustes.precioBase;
  const pExtra = extra * ajustes.precioExtra;
  const pNocturna = nocturnas * ajustes.precioNocturna;
  const bruto = base + pExtra + pNocturna;
  const descuentos = (bruto * ajustes.descuentosPct) / 100;
  const irpf = (bruto * ajustes.irpfPct) / 100;
  return {
    horasAsignadas: redondear(asignadas),
    horasExtra: redondear(extra),
    horasNocturnas: redondear(nocturnas),
    base: redondear(base),
    extra: redondear(pExtra),
    nocturnidad: redondear(pNocturna),
    bruto: redondear(bruto),
    descuentos: redondear(descuentos),
    irpf: redondear(irpf),
    liquido: redondear(bruto - descuentos - irpf),
  };
}

// ---- Periodos ----

const dos = (n) => String(n).padStart(2, '0');

export function periodosDelMes(anio, mes) {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const p = `${anio}-${dos(mes)}`;
  return {
    mes: { desde: `${p}-01`, hasta: `${p}-${dos(ultimo)}` },
    q1: { desde: `${p}-01`, hasta: `${p}-15` },
    q2: { desde: `${p}-16`, hasta: `${p}-${dos(ultimo)}` },
  };
}

export function filtrarPeriodo(turnos, desde, hasta) {
  return turnos.filter((t) => t.fecha >= desde && t.fecha <= hasta);
}

export function horasDelAnio(turnos, anio) {
  let total = 0;
  for (const t of turnos) {
    if (t.fecha.startsWith(`${anio}-`)) total += calcularTurno(t).trabajadas;
  }
  return redondear(total);
}

// ---- Validación ----

const RE_HORA = /^\d{2}:\d{2}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarTurno(t) {
  const errores = [];
  const avisos = [];
  if (!RE_FECHA.test(t.fecha || '')) errores.push('Falta la fecha.');
  const campos = [
    ['asignadoEntrada', 'la entrada asignada'],
    ['asignadoSalida', 'la salida asignada'],
    ['realEntrada', 'la entrada real'],
    ['realSalida', 'la salida real'],
  ];
  for (const [clave, nombre] of campos) {
    if (!RE_HORA.test(t[clave] || '')) errores.push(`Falta ${nombre}.`);
  }
  if (errores.length) return { errores, avisos };

  if (t.asignadoEntrada === t.asignadoSalida) {
    errores.push('La entrada y la salida asignadas son iguales.');
  }
  if (t.realEntrada === t.realSalida) {
    errores.push('La entrada y la salida reales son iguales.');
  }
  if (errores.length) return { errores, avisos };

  const c = calcularTurno(t);
  if (c.asignadas > 12) {
    avisos.push(`El turno asignado dura ${c.asignadas} h. Si la salida es al día siguiente está bien; si no, revisa la hora.`);
  }
  if (c.trabajadas > 12) {
    avisos.push(`El turno real dura ${c.trabajadas} h. Si la salida es al día siguiente está bien; si no, revisa la hora.`);
  }
  return { errores, avisos };
}
