# 🛒 SuperCasa

App web (PWA) para tener **todas mis recetas en un solo lugar** y que la **lista del súper se arme sola**.

Funciona en el celular, se puede instalar como app y guarda todo **solo en tu dispositivo**
(no necesita cuenta, ni internet una vez cargada).

## ¿Qué hace?

### 📖 Recetas
- **Foto**: sacale foto a la receta del libro, del cuaderno o del plato. Se guardan varias fotos por receta.
- **Links**: pegá el link de **TikTok, Instagram, YouTube o Pinterest** y queda guardado con su ícono.
- **A mano**: nombre, porciones, tiempo, ingredientes, preparación y etiquetas.
- **📋 Pegar lista**: pegás los ingredientes tal cual los copiaste (`2 tazas de arroz`, `300 g de pollo`,
  `1 cebolla`) y la app los separa en cantidad + unidad + ingrediente sola.
- Buscador por nombre **o por ingrediente**, favoritas ⭐ y filtros por etiqueta.

### 🗓️ Semana
- Elegís qué cocinar **cada día** de la semana (esta semana o la próxima).
- Para cada comida decís **cuántas personas comen** — las cantidades se reescalan solas
  según las porciones que rinde la receta.

### 🧊 Refri
- Anotás lo que **ya tenés en casa** (con cantidad o sin ella).
- Chips rápidos para lo de siempre: huevos, cebolla, arroz, aceite…

### 🛒 Lista del súper
- Junta los ingredientes de todas las comidas de la semana, **suma cantidades repetidas**,
  **resta lo que hay en el refri** y agrupa todo **por pasillo** (frutas y verduras, proteína,
  granel, despensa…) para recorrer el súper de corrido.
- Se marcan los productos comprados, hay barra de progreso y podés **compartir la lista por WhatsApp**.
- También podés agregar cosas sueltas que no vienen de ninguna receta.

### 🔔 Recordatorio de los jueves
- Los **jueves** la app te avisa que es día de armar el menú y la lista para el **súper orgánico**.
- El aviso aparece al abrir la app; si le das permiso a las notificaciones, además te llega una
  notificación del navegador. La hora se configura en Ajustes.

## Cómo usarla

1. Abrí `index.html` en el navegador del celular (o la URL donde esté publicada).
2. En Chrome/Safari elegí **"Agregar a pantalla de inicio"** para instalarla como app.
3. Cargá tus recetas con el botón **+**, armá la semana y andá a **🛒 Lista**.

Para publicarla gratis: subir esta carpeta a **GitHub Pages**, Netlify o Vercel.

## Notas

- Todo se guarda en tu celular: las recetas y las listas en `localStorage`, las fotos en `IndexedDB`
  (comprimidas a ~1400 px para que no ocupen de más).
- Hacé **Ajustes → Exportar** de vez en cuando: es un archivo con todo, fotos incluidas.
- Si usás **modo privado de Safari**, el navegador no guarda nada y la app te lo avisa arriba.

## Estructura

```
index.html            · estructura y vistas
css/styles.css        · estilos (tema oscuro/claro)
js/data.js            · pasillos del súper, unidades y clasificación de ingredientes
js/db.js              · fotos en IndexedDB + compresión de imágenes
js/app.js             · lógica (recetas, menú semanal, refri, lista, recordatorio)
manifest.webmanifest  · configuración PWA
sw.js                 · service worker (offline)
icon.svg              · ícono de la app
```
