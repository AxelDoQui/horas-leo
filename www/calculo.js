// Lógica de cálculo de horas. Sin pantalla ni navegador: se prueba con node --test.
// Las horas se tratan como «hora de reloj» (Date.UTC), así que el cambio de hora
// de verano no altera la duración de un turno.

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

const dos = (n) => String(n).padStart(2, '0');

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

// Un turno por sí solo: asignadas, trabajadas, nocturnas y diferencia.
// Las horas extra NO se calculan aquí: dependen de la semana (ver detallarTurnos).
export function calcularTurno(t) {
  const asig = intervalo(t.fecha, t.asignadoEntrada, t.asignadoSalida);
  const real = intervalo(t.fecha, t.realEntrada, t.realSalida);
  const asignadas = (asig.fin - asig.ini) / HORA;
  const trabajadas = (real.fin - real.ini) / HORA;
  return {
    asignadas: redondear(asignadas),
    trabajadas: redondear(trabajadas),
    nocturnas: redondear(horasNocturnas(real)),
    diferencia: redondear(trabajadas - asignadas),
  };
}

// ---- Fechas (todas 'AAAA-MM-DD') ----

export function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d) + n * DIA);
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

// Días de calendario entre dos fechas (negativo si `hasta` es anterior a `desde`).
export function diasEntre(desde, hasta) {
  const ms = (f) => {
    const [a, m, d] = f.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(hasta) - ms(desde)) / DIA);
}

// Semana de lunes a domingo que contiene la fecha.
export function semanaDe(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  const desde = sumarDias(fecha, -((dia + 6) % 7));
  return { desde, hasta: sumarDias(desde, 6) };
}

// Casillas del calendario de un mes, empezando en lunes: fecha o null para los huecos.
// La longitud siempre es múltiplo de 7.
export function rejillaMes(anio, mes) {
  const primero = `${anio}-${dos(mes)}-01`;
  const huecos = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const celdas = Array(huecos).fill(null);
  for (let i = 0; i < ultimo; i++) celdas.push(sumarDias(primero, i));
  while (celdas.length % 7) celdas.push(null);
  return celdas;
}

// ---- Jornada semanal (tope de horas ordinarias) ----

// `topes` es un número fijo, o una lista [{ desde: 'AAAA-MM-DD', horas }] con los cambios
// de jornada. Devuelve las horas semanales vigentes en esa fecha; si la fecha es anterior
// al primer cambio, vale el primero.
export function topeDeFecha(fecha, topes) {
  if (typeof topes === 'number') return topes;
  const orden = topes.slice().sort((a, b) => a.desde.localeCompare(b.desde));
  let horas = orden[0].horas;
  for (const j of orden) if (j.desde <= fecha) horas = j.horas;
  return horas;
}

// Devuelve un texto de error, o '' si la lista de jornadas es correcta.
export function validarJornadas(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return 'Pon al menos una jornada.';
  const vistas = new Set();
  for (const j of lista) {
    if (!RE_FECHA.test(j.desde || '')) return 'Falta la fecha de una jornada.';
    if (!Number.isFinite(j.horas) || j.horas <= 0) return 'Las horas de cada jornada tienen que ser más de 0.';
    if (vistas.has(j.desde)) return 'Hay dos jornadas con la misma fecha.';
    vistas.add(j.desde);
  }
  return '';
}

// ---- Tope semanal ----

// Reparte las horas de cada turno en ordinarias y extra (complementarias).
// Las extra son las horas trabajadas de la semana (lunes a domingo) que pasan del tope
// semanal (el vigente el lunes de esa semana, ver topeDeFecha), estén o no dentro del
// turno asignado. Hay que pasar TODOS los turnos
// (no solo los de un mes) para que una semana que cruza de mes se cuente entera.
// Devuelve un Map: turno (el mismo objeto) → { asignadas, trabajadas, nocturnas,
// diferencia, extra, ordinarias }.
export function detallarTurnos(turnos, topes) {
  const detalle = new Map();
  const acumulado = new Map(); // lunes de la semana → horas ya trabajadas
  const orden = turnos.slice().sort((a, b) => (a.fecha + a.realEntrada).localeCompare(b.fecha + b.realEntrada));
  for (const t of orden) {
    const c = calcularTurno(t);
    const semana = semanaDe(t.fecha).desde;
    const despues = (acumulado.get(semana) || 0) + c.trabajadas;
    acumulado.set(semana, despues);
    const extra = Math.min(c.trabajadas, Math.max(0, despues - topeDeFecha(semana, topes)));
    detalle.set(t, { ...c, extra: redondear(extra), ordinarias: redondear(c.trabajadas - extra) });
  }
  return detalle;
}

// ---- Estimación de nómina ----

// `turnos` son los del periodo a estimar; `todos` son todos los que hay (para que el
// tope semanal cuente también las horas de otras semanas o meses). Si no se pasa
// `todos`, se usan solo `turnos`.
export function estimarNomina(turnos, ajustes, todos = turnos) {
  const topes = ajustes.jornadas ?? ajustes.topeSemanal;
  const detalle = detallarTurnos(todos, topes);
  let asignadas = 0;
  let ordinarias = 0;
  let extra = 0;
  let nocturnas = 0;
  for (const t of turnos) {
    const c = detalle.get(t) || detallarTurnos([t], topes).get(t);
    asignadas += c.asignadas;
    ordinarias += c.ordinarias;
    extra += c.extra;
    nocturnas += c.nocturnas;
  }
  const base = ordinarias * ajustes.precioBase;
  const pExtra = extra * ajustes.precioExtra;
  const pNocturna = nocturnas * ajustes.precioNocturna;
  const bruto = base + pExtra + pNocturna;
  const descuentos = (bruto * ajustes.descuentosPct) / 100;
  const irpf = (bruto * ajustes.irpfPct) / 100;
  return {
    horasAsignadas: redondear(asignadas),
    horasOrdinarias: redondear(ordinarias),
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

// ¿La salida cae al día siguiente? (turnos de noche, p. ej. 22:00 → 02:00)
export function cruzaMedianoche(entrada, salida) {
  return salida <= entrada;
}

// Turno partido: ¿el segundo tramo empieza antes de que acabe el primero?
// Se comprueba tanto en lo real como en lo asignado.
export function tramosSolapan(a, b) {
  const pares = [['asignadoEntrada', 'asignadoSalida'], ['realEntrada', 'realSalida']];
  return pares.some(([e, s]) => {
    const x = intervalo(a.fecha, a[e], a[s]);
    const y = intervalo(b.fecha, b[e], b[s]);
    return y.ini < x.fin && x.ini < y.fin;
  });
}
