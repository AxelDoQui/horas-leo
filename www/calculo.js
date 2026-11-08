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
