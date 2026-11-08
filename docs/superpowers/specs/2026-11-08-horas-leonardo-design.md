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
nocturna (0,48), porcentaje de descuentos (6,50), IRPF (0), límite anual de horas (896).

## Cálculo (por turno)

- **Horas asignadas** = salida asignada − entrada asignada.
- **Horas extra** = horas reales trabajadas fuera del tramo asignado
  (antes de la entrada asignada y después de la salida asignada).
  Si trabaja menos de lo asignado no hay extra; se muestra la diferencia en negativo.
- **Horas nocturnas** = horas reales entre las 22:00 y las 07:00,
  contando bien los turnos que cruzan la medianoche.

## Estimación de nómina (por periodo)

- Base = horas asignadas × precio por hora de la base (editable en Ajustes).
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
4. **Contador anual:** horas hechas frente al límite de 896 h.

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
