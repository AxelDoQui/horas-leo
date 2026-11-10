# Horas Leonardo — diseño

Fecha: 2026-11-08

## Objetivo

App de Android (APK) para que Leonardo apunte cada día su turno y sepa:
cuántas horas eran las **asignadas** por su horario, cuántas son **extra**
(horas complementarias), cuántas son **nocturnas**, y una **estimación de su nómina**.

Todo en español. Sin cuentas ni internet: los datos viven en el móvil.

## Datos de partida (contrato y nómina de octubre de 2026)

- Empresa: Burger King Spain S.L.U. Convenio sectorial estatal de restauración moderna.
- Contrato indefinido a **tiempo parcial: 896 horas al año**, con **pacto de horas complementarias**.
- Turnos rotativos de lunes a domingo: mañana 07–14, tarde 14–22, noche 22–07.
- La nómina de octubre se partió en dos periodos (02/10–18/10 y 19/10–31/10).
- Conceptos que dependen de las horas:
  - Salario base: por días (17 d × 20,35 € y 13 d × 25,44 €).
  - Nocturnidad tramo 1: por horas, 0,48 €/h.
  - Horas complementarias: por horas, 9,54 €/h.
- Deducciones: 4,70 % contingencias comunes + 1,55 % desempleo + 0,10 % formación
  + 0,15 % mecanismo de equidad = 6,50 %. IRPF a 0 %.

## Modelo de datos

**Turno** (un registro por día):
- `fecha`
- `asignadoEntrada`, `asignadoSalida`: el turno del cuadrante.
- `realEntrada`, `realSalida`: lo que trabajó de verdad.
- `nota` (opcional).

Las horas se guardan como fecha-hora completas. Si la salida es anterior a la entrada,
se entiende que cruza la medianoche y cae al día siguiente.

**Ajustes:** precio por hora de la base, precio por hora extra (9,54), precio por hora
nocturna (0,48), porcentaje de descuentos (6,50), IRPF (0), historial de jornada semanal (fecha y horas: 20 h desde el 02/10/2026, 25 h desde el 19/10/2026), límite anual de horas (1.120: las 896 h del contrato original de 20 h/semana × 25/20, decidido el 2026-11-08).

## Cálculo (por turno)

- **Horas asignadas** = salida asignada − entrada asignada.
- **Horas trabajadas** = salida real − entrada real. Si trabaja menos de lo asignado
  se muestra la diferencia en negativo.
- **Horas extra (complementarias)** = horas trabajadas de la semana (lunes a domingo)
  por encima del tope semanal, estén o no dentro del turno asignado. El tope es la jornada
  vigente el lunes de esa semana: **20 h hasta el 18/10/2026 y 25 h desde el 19/10/2026**
  (variación de jornada firmada el 16/10/2026), editable como lista de cambios en Ajustes.
  *(Decidido el 2026-11-08: el turno asignado ya no define las extra, solo sirve para comparar.)*
  Se calcula con todos los turnos de la semana aunque cruce de mes, y en el turno que
  cruza el tope solo cuenta como extra la parte que lo pasa.
- **Horas ordinarias** = horas trabajadas − horas extra.
- **Horas nocturnas** = horas reales entre las 22:00 y las 07:00,
  contando bien los turnos que cruzan la medianoche.

## Estimación de nómina (por periodo)

- Base = horas ordinarias × precio por hora de la base (editable en Ajustes).
  Se usan las ordinarias y no las asignadas para no pagar dos veces una hora dentro del tope.
  Por defecto 9,54 €/h, el mismo precio que la nómina da a las horas complementarias
  (por ley se pagan igual que las ordinarias). Es un supuesto, no un dato de la nómina.
- Extra = horas extra × 9,54 €.
- Nocturnidad = horas nocturnas × 0,48 €.
- Bruto = suma de lo anterior.
- Líquido = bruto − (bruto × descuentos) − IRPF.

Es una **estimación**: en la nómina real el salario base se paga por días y los dos
precios del mes difieren, así que el resultado es aproximado y así se le dice en pantalla.

## Pantallas

1. **Mes:** lista de turnos y totales (asignadas, extra, nocturnas) y estimación.
   Se puede cambiar de mes y ver por quincena.
2. **Añadir/editar turno:** fecha y las cuatro horas, con aviso si los datos no cuadran.
3. **Ajustes:** precios y descuentos, ya rellenados con los de octubre.
4. **Contador anual:** horas hechas frente al límite anual (1.120 h).

**Añadidos tras probar en un Android real (2026-11-08):**
- **Días libres.** Un día se puede marcar como libre desde el formulario («Día libre»). Cuenta
  como rellenado (marca «–», borde discontinuo) para que el calendario no llene de ○ los días de
  descanso. Tocar un día libre lo quita. Guardar un turno en un día libre lo quita de libres, y
  no se puede marcar libre un día con turno. Van en la copia de seguridad.
- **Botón «atrás» de Android.** Con el plugin `@capacitor/app`: en el formulario lo cierra, en
  cualquier otra pantalla vuelve al Calendario, y solo desde el Calendario sale de la app.
  Sin esto Android cerraba la app y se perdía lo escrito.
- **Aviso de copia de seguridad.** En el Calendario, si hay turnos y no hay copia hecha o la
  última tiene más de 14 días, sale un aviso con un botón que lleva a Ajustes.

## Estructura

Carpeta `Horas Leonardo APP` con su propio git, separada de Cierre de Caja.

- `calculo.js`: lógica pura, sin pantalla. Probada con tests automáticos con casos de la
  nómina (p. ej. 5,95 h × 0,48 € = 2,86 €; la nómina muestra 2,84 € porque
  redondea el precio, y la app no lo reproduce al céntimo).
- `almacen.js`: guarda y lee turnos y ajustes con `localStorage`;
  exportar e importar copia como texto que se copia y se pega (el WebView de
  Android no descarga archivos de forma fiable).
- `index.html`, `estilos.css`, `app.js`: interfaz pensada para móvil.
  Todos los archivos web (también `calculo.js` y `almacen.js`) van en `www/`.
- Capacitor empaqueta la web como proyecto Android; se genera un APK de depuración.

## Fuera de alcance

Cuentas, sincronización entre móviles, publicación en Google Play, cálculo del IRPF.

## Verificación

Tests del cálculo y prueba de la interfaz en el navegador antes de empaquetar.
El aspecto en el móvil real lo confirma Leonardo al instalarlo.

## Actualizaciones por GitHub (2026-11-08)

Repositorio público `AxelDoQui/horas-leo`. Al abrir, la app pregunta por la última Release
(`api.github.com/repos/.../releases/latest`, sin claves); si su etiqueta es más nueva que
`www/version.js`, el Calendario muestra «Descargar e instalar», que abre el APK en el navegador.
Android exige tocar «Instalar», así que no puede ser del todo automático. Sin internet, no pasa nada.

**Publicar una versión nueva:** subir `VERSION` en `www/version.js`, `npx cap sync android`,
`gradlew assembleDebug`, copiar el APK a `Horas-Leo.apk` y
`gh release create vX.Y.Z Horas-Leo.apk --repo AxelDoQui/horas-leo`.
El APK debe compilarse siempre en este PC (misma clave de depuración) o Android no lo dejará
instalar encima.

## Cierres de nómina y detalle del día (2026-11-10)

- **Periodos de cierre.** La empresa cierra las horas complementarias por periodos de 4 o 5 semanas
  enteras (lunes a domingo), según su calendario 2026. En `almacen.js` (`cierres`) se guardan solo
  los lunes de inicio; cada periodo acaba el domingo antes del siguiente. El último se supone de
  4 semanas hasta que se añada el siguiente (Ajustes → «Cierres de nómina», se guarda al momento).
  La vista **Mes** suma por estos periodos («Cierre de noviembre» = el que acaba en noviembre);
  «Mes natural» conserva el mes del calendario y sus quincenas. Al ser semanas enteras, las
  horas extra de una semana nunca quedan partidas entre dos periodos.
- **Detalle del día.** Tocar un día con turnos abre una hoja con sus tramos, el total y
  «+ Otro tramo» (antes, con varios turnos saltaba a la Semana).
- Los periodos se leyeron de una foto del calendario impreso: si alguna fecha no coincide con el
  original, se corrige en Ajustes.
