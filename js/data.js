/* ============================================================
   SuperCasa — datos base: pasillos, unidades y clasificación
   ============================================================ */
'use strict';

/* ---------- Pasillos del súper (orden = orden del recorrido) ---------- */
const AISLES = [
  { id: 'frutas',     name: 'Frutas y verduras',      emoji: '🥬' },
  { id: 'proteina',   name: 'Proteína',               emoji: '🍗' },
  { id: 'lacteos',    name: 'Lácteos y alternativas', emoji: '🥛' },
  { id: 'granel',     name: 'Granel y granos',        emoji: '🌾' },
  { id: 'panaderia',  name: 'Panadería y tortillas',  emoji: '🥖' },
  { id: 'despensa',   name: 'Despensa',               emoji: '🫙' },
  { id: 'especias',   name: 'Especias y condimentos', emoji: '🧂' },
  { id: 'congelados', name: 'Congelados',             emoji: '🧊' },
  { id: 'bebidas',    name: 'Bebidas',                emoji: '🧃' },
  { id: 'otros',      name: 'Otros',                  emoji: '🛒' },
];
const aisleById = id => AISLES.find(a => a.id === id) || AISLES[AISLES.length - 1];

/* ---------- Unidades ---------- */
/* Solo convertimos dentro de la misma familia (g↔kg, ml↔l). Las medidas
   caseras (taza, cda) no se convierten porque dependen del ingrediente. */
const UNITS = [
  { id: 'g',      label: 'g',        base: 'g',  factor: 1 },
  { id: 'kg',     label: 'kg',       base: 'g',  factor: 1000 },
  { id: 'ml',     label: 'ml',       base: 'ml', factor: 1 },
  { id: 'l',      label: 'l',        base: 'ml', factor: 1000 },
  { id: 'pza',    label: 'pza',      base: 'pza', factor: 1 },
  { id: 'taza',   label: 'taza',     base: 'taza', factor: 1 },
  { id: 'cda',    label: 'cda',      base: 'cda', factor: 1 },
  { id: 'cdta',   label: 'cdta',     base: 'cdta', factor: 1 },
  { id: 'manojo', label: 'manojo',   base: 'manojo', factor: 1 },
  { id: 'lata',   label: 'lata',     base: 'lata', factor: 1 },
  { id: 'paq',    label: 'paquete',  base: 'paq', factor: 1 },
  { id: '',       label: 'al gusto', base: '',   factor: 1 },
];
const unitById = id => UNITS.find(u => u.id === (id || '')) || UNITS[UNITS.length - 1];

/* ---------- Clasificación automática por palabras clave ---------- */
/* Se revisa en orden: gana la primera coincidencia. Español de México. */
const AISLE_KEYWORDS = [
  ['proteina', ['pollo', 'pechuga', 'muslo', 'res', 'carne', 'bistec', 'molida', 'arrachera', 'cerdo', 'chuleta',
    'pescado', 'salmon', 'atun fresco', 'camaron', 'mariscos', 'tocino', 'jamon', 'salchicha', 'chorizo',
    'huevo', 'huevos', 'pavo', 'cordero', 'higado', 'tofu', 'tempeh', 'seitan']],
  ['lacteos', ['leche', 'yogur', 'yoghurt', 'yogurt', 'queso', 'panela', 'oaxaca', 'manchego', 'requeson', 'ricotta',
    'crema', 'mantequilla', 'mantequilla de mani', 'kefir', 'jocoque', 'bebida de almendra', 'bebida de avena',
    'leche de coco', 'leche de almendra', 'ghee']],
  ['frutas', ['jitomate', 'tomate', 'cebolla', 'ajo', 'papa', 'zanahoria', 'lechuga', 'espinaca', 'kale', 'acelga',
    'brocoli', 'coliflor', 'calabacita', 'calabaza', 'chayote', 'nopal', 'elote', 'maiz fresco', 'chile', 'jalapeno',
    'poblano', 'serrano', 'pimiento', 'morron', 'apio', 'pepino', 'ejote', 'chicharo', 'champinon', 'hongo', 'setas',
    'aguacate', 'cilantro', 'perejil', 'albahaca', 'hierbabuena', 'epazote', 'romero fresco', 'limon', 'lima',
    'naranja', 'mandarina', 'toronja', 'manzana', 'pera', 'platano', 'banana', 'fresa', 'frambuesa', 'mora',
    'arandano', 'blueberry', 'uva', 'mango', 'papaya', 'melon', 'sandia', 'pina', 'durazno', 'ciruela', 'kiwi',
    'higo', 'granada', 'betabel', 'rabano', 'poro', 'puerro', 'col', 'coles', 'germinado', 'jengibre', 'cebollin',
    'esparrago', 'berenjena', 'camote', 'yuca']],
  ['granel', ['arroz', 'frijol', 'frijoles', 'lenteja', 'lentejas', 'garbanzo', 'garbanzos', 'quinoa', 'avena',
    'amaranto', 'trigo', 'cebada', 'mijo', 'almendra', 'almendras', 'nuez', 'nueces', 'cacahuate', 'pistache',
    'semilla', 'semillas', 'chia', 'linaza', 'ajonjoli', 'girasol', 'pepita', 'pepitas', 'granola', 'cuscus',
    'bulgur', 'harina']],
  ['panaderia', ['pan', 'tortilla', 'tortillas', 'tostada', 'tostadas', 'bolillo', 'baguette', 'pita', 'wrap',
    'bagel', 'croissant', 'masa']],
  ['congelados', ['congelado', 'congelada', 'congelados', 'congeladas', 'helado']],
  ['bebidas', ['agua', 'jugo', 'refresco', 'cafe', 'te', 'infusion', 'kombucha', 'vino', 'cerveza']],
  ['especias', ['sal', 'pimienta', 'comino', 'oregano', 'canela', 'curcuma', 'paprika', 'pimenton', 'laurel',
    'tomillo', 'romero', 'nuez moscada', 'clavo', 'cardamomo', 'curry', 'chile en polvo', 'ajo en polvo',
    'cebolla en polvo', 'especias', 'vainilla']],
  ['despensa', ['aceite', 'oliva', 'vinagre', 'salsa', 'soya', 'tamari', 'mostaza', 'catsup', 'ketchup', 'mayonesa',
    'miel', 'azucar', 'panela', 'piloncillo', 'stevia', 'jarabe', 'maple', 'atun', 'sardina', 'lata', 'pure',
    'pasta', 'espagueti', 'fideo', 'macarron', 'caldo', 'consome', 'levadura', 'polvo para hornear', 'bicarbonato',
    'cacao', 'chocolate', 'coco rallado', 'tahini', 'hummus', 'aceituna', 'alcaparra', 'chipotle', 'adobo']],
];

/* Quita acentos y baja a minúsculas para comparar nombres de ingredientes */
function norm(s) {
  return (s || '').toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/* Adivina el pasillo de un ingrediente por su nombre.
   Compara por palabra completa para que "salsa" no caiga en "sal". */
const _kwCache = new Map();
function _kwRegex(word) {
  let re = _kwCache.get(word);
  if (!re) {
    re = new RegExp('(^|\\s)' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|\\s)');
    _kwCache.set(word, re);
  }
  return re;
}
function guessAisle(name) {
  const n = norm(name);
  if (!n) return 'otros';
  for (const [aisle, words] of AISLE_KEYWORDS) {
    for (const w of words) if (_kwRegex(w).test(n)) return aisle;
  }
  return 'otros';
}

/* ---------- Tipos de link reconocidos ---------- */
const LINK_KINDS = [
  { id: 'tiktok',    emoji: '🎵', name: 'TikTok',    test: u => /tiktok\.com/i.test(u) },
  { id: 'instagram', emoji: '📸', name: 'Instagram', test: u => /instagram\.com/i.test(u) },
  { id: 'youtube',   emoji: '▶️', name: 'YouTube',   test: u => /(youtube\.com|youtu\.be)/i.test(u) },
  { id: 'pinterest', emoji: '📌', name: 'Pinterest', test: u => /pinterest\./i.test(u) },
  { id: 'web',       emoji: '🔗', name: 'Link',      test: () => true },
];
const linkKind = url => LINK_KINDS.find(k => k.test(url || '')) || LINK_KINDS[LINK_KINDS.length - 1];

/* Miniatura de YouTube (los demás no permiten leerla sin servidor) */
function youtubeThumb(url) {
  const m = (url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

/* ---------- Días de la semana ---------- */
const DAYS = [
  { id: 1, short: 'Lun', name: 'Lunes' },
  { id: 2, short: 'Mar', name: 'Martes' },
  { id: 3, short: 'Mié', name: 'Miércoles' },
  { id: 4, short: 'Jue', name: 'Jueves' },
  { id: 5, short: 'Vie', name: 'Viernes' },
  { id: 6, short: 'Sáb', name: 'Sábado' },
  { id: 0, short: 'Dom', name: 'Domingo' },
];

/* ---------- Cosas que casi siempre hay en el refri (chips rápidos) ---------- */
const PANTRY_QUICK = [
  'Huevos', 'Leche', 'Jitomate', 'Cebolla', 'Ajo', 'Limón', 'Aguacate', 'Zanahoria',
  'Arroz', 'Frijol', 'Pasta', 'Aceite de oliva', 'Sal', 'Pimienta', 'Yogur', 'Queso',
  'Pollo', 'Tortillas', 'Espinaca', 'Plátano', 'Manzana', 'Avena', 'Pan', 'Mantequilla',
];

/* ---------- Recetas de ejemplo (opcionales, para ver cómo funciona) ---------- */
const SAMPLE_RECIPES = [
  {
    name: 'Bowl de pollo con verduras',
    emoji: '🥗',
    servings: 2,
    time: '30 min',
    tags: ['comida', 'sano'],
    ingredients: [
      { name: 'Pechuga de pollo', qty: 300, unit: 'g' },
      { name: 'Arroz integral', qty: 1, unit: 'taza' },
      { name: 'Brócoli', qty: 250, unit: 'g' },
      { name: 'Zanahoria', qty: 2, unit: 'pza' },
      { name: 'Aceite de oliva', qty: 2, unit: 'cda' },
      { name: 'Ajo', qty: 2, unit: 'pza' },
      { name: 'Sal', qty: null, unit: '' },
    ],
    notes: 'Saltear el pollo, cocer el arroz y el brócoli al vapor. Mezclar con aceite de oliva y limón.',
  },
  {
    name: 'Chilaquiles verdes',
    emoji: '🌶️',
    servings: 2,
    time: '20 min',
    tags: ['desayuno'],
    ingredients: [
      { name: 'Tostadas', qty: 1, unit: 'paq' },
      { name: 'Tomate verde', qty: 500, unit: 'g' },
      { name: 'Chile serrano', qty: 2, unit: 'pza' },
      { name: 'Cebolla', qty: 1, unit: 'pza' },
      { name: 'Cilantro', qty: 1, unit: 'manojo' },
      { name: 'Queso panela', qty: 150, unit: 'g' },
      { name: 'Huevos', qty: 2, unit: 'pza' },
    ],
    notes: 'Hervir los tomates con el chile, licuar con cebolla y cilantro. Freír la salsa y bañar las tostadas.',
  },
  {
    name: 'Pasta con pesto y jitomate',
    emoji: '🍝',
    servings: 4,
    time: '25 min',
    tags: ['cena', 'rápido'],
    ingredients: [
      { name: 'Pasta', qty: 400, unit: 'g' },
      { name: 'Albahaca', qty: 1, unit: 'manojo' },
      { name: 'Nuez', qty: 60, unit: 'g' },
      { name: 'Queso parmesano', qty: 80, unit: 'g' },
      { name: 'Aceite de oliva', qty: 120, unit: 'ml' },
      { name: 'Jitomate cherry', qty: 300, unit: 'g' },
      { name: 'Ajo', qty: 2, unit: 'pza' },
    ],
    notes: 'Licuar albahaca, nuez, ajo, queso y aceite. Mezclar con la pasta caliente y el jitomate partido.',
  },
];
