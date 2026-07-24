# 🏋️‍♀️ Mi Rutina de Hipertrofia

App web (PWA) de rutina de **hipertrofia para gym, 4 días por semana, sin abdomen**.
Funciona en el celular, se puede instalar como app y guarda tu progreso **solo en tu dispositivo** (no necesita cuenta ni internet una vez cargada).

## ¿Qué hace?

- **Rutina de 4 días** dividida en:
  - 💪 Día 1 — Pecho y Tríceps
  - 🔙 Día 2 — Espalda y Bíceps
  - 🦵 Día 3 — Piernas
  - 🏔️ Día 4 — Hombros y Brazos
- Para **cada ejercicio** te muestra:
  - Demostración animada (imagen tipo GIF) + link a un video de YouTube.
  - **Series, repeticiones y peso en libras** (editable con + / −).
  - **Cómo prepararlo / configurar la máquina** y la técnica clave.
  - Tiempo de descanso.
- **Cambiar de ejercicio** 🔄: cada ejercicio tiene alternativas para elegir.
- **Semáforo de esfuerzo** 🟢🟡🔴: después de cada ejercicio te pregunta si estuvo
  fácil / medio / difícil y **ajusta el peso sugerido** para la próxima vez
  (sobrecarga progresiva automática).
- **Temporizador de descanso** con aviso sonoro y vibración.
- **Progreso**: racha de días, volumen por sesión, historial y **registro de peso corporal**.
- **❤️ Salud** (datos privados, solo en tu celular):
  - Perfil con cálculo de **calorías y proteína** según tu objetivo.
  - 💧 **Control de agua** diario con meta de vasos.
  - 🌙 **Adaptación al ciclo menstrual**: calcula tu fase y adapta la
    recomendación de intensidad y consejos de nutrición.
  - 💍 **Integración con Oura**: trae tu Readiness, Sueño y Pasos, y ajusta
    la sugerencia del día. Ver [guía de conexión](docs/oura-proxy.md).
  - Un **banner diario** en la rutina combina tu fase del ciclo + Oura para
    decirte si es día de empujar o de aflojar.
- 🔁 **Rotación semanal**: cada semana la app usa una variante distinta de
  cada ejercicio (misma zona muscular) para dar variedad. Se puede apagar en
  Ajustes.
- 🤖 **Adaptación con Oura**: según tu Readiness del día, la app ajusta el
  entrenamiento de verdad (baja series y sube el descanso si venís cansada,
  o te habilita a empujar si estás a tope).
- **Calentamiento** sugerido por día.
- **Respaldo**: exportar/importar tus datos en un archivo.
- Tema oscuro/claro, funciona **offline** (PWA instalable).

## Cómo usarla

1. Abrí `index.html` en el navegador del celular.
2. En Chrome/Safari elegí **"Agregar a pantalla de inicio"** para instalarla como app.
3. ¡Listo! Elegí el día, hacé tus series y marcá el semáforo.

Para publicarla online gratis podés subir esta carpeta a GitHub Pages, Netlify o Vercel.

## Notas

- Los pesos y repeticiones son una **guía inicial**: ajustalos a tu nivel.
- Las demostraciones vienen de la base abierta [free-exercise-db](https://github.com/yuhonas/free-exercise-db).
- Esto no reemplaza el consejo de un profesional. Ante dolor o dudas, consultá a un entrenador o médico.

## Estructura

```
index.html            · estructura y vistas
css/styles.css        · estilos (tema oscuro/claro)
js/data.js            · rutina + base de 40 ejercicios en español
js/app.js             · lógica (semáforo, progresión, temporizador, progreso)
manifest.webmanifest  · configuración PWA
sw.js                 · service worker (offline)
icon.svg              · ícono de la app
```
