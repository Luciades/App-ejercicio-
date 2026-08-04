/* ============================================================
   Base de ejercicios + rutina de hipertrofia (4 días, sin abdomen)
   Imágenes: free-exercise-db (2 frames -> se animan tipo GIF)
   ============================================================ */

const APP_VERSION = 'v12 · ayuno + receta';
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
function frames(id) { return [RAW + id + '/0.jpg', RAW + id + '/1.jpg']; }
function yt(name) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent('como hacer ' + name + ' tecnica'); }

/* Diccionario de ejercicios. clave = id de la base de imágenes.
   es = nombre en español · musc = músculo · equip = equipo
   setup = cómo configurar la máquina/preparar · tip = técnica clave */
const EX = {
  // ---------- PECHO ----------
  'Barbell_Bench_Press_-_Medium_Grip': { es:'Press de banca con barra', musc:'Pecho', equip:'Barra',
    setup:'Acostate en el banco plano con los ojos debajo de la barra. Pies firmes en el piso, espalda con un leve arco. Agarre un poco más ancho que los hombros.',
    tip:'Bajá la barra al centro del pecho tocando suave, codos a ~45°. Empujá sin rebotar.' },
  'Dumbbell_Bench_Press': { es:'Press de banca con mancuernas', musc:'Pecho', equip:'Mancuernas',
    setup:'Banco plano. Sentate con las mancuernas sobre los muslos y recostate impulsándolas a la posición inicial, a la altura del pecho.',
    tip:'Bajá hasta sentir estiramiento en el pecho, subí juntando arriba sin chocar las mancuernas.' },
  'Machine_Bench_Press': { es:'Press de pecho en máquina', musc:'Pecho', equip:'Máquina',
    setup:'Ajustá el asiento para que las manijas queden a la altura del pecho medio. Espalda apoyada en el respaldo.',
    tip:'Empujá al frente estirando casi del todo y volvé despacio controlando.' },
  'Incline_Dumbbell_Press': { es:'Press inclinado con mancuernas', musc:'Pecho superior', equip:'Mancuernas',
    setup:'Regulá el banco a 30–45°. Apoyá bien la espalda, mancuernas a la altura de la parte alta del pecho.',
    tip:'Empujá hacia arriba y adentro. No inclines demasiado el banco para no cargar hombros.' },
  'Butterfly': { es:'Contractora / Pec deck', musc:'Pecho', equip:'Máquina',
    setup:'Ajustá el asiento para que las manijas queden a la altura de los hombros. Espalda pegada al respaldo.',
    tip:'Juntá los codos al frente apretando el pecho, volvé lento sintiendo el estiramiento.' },
  'Cable_Crossover': { es:'Cruce de poleas', musc:'Pecho', equip:'Poleas',
    setup:'Colocá ambas poleas en alto. Agarrá una manija en cada mano y da un paso al frente con el torso levemente inclinado.',
    tip:'Cruzá las manos abajo y al centro apretando el pecho. Movimiento de abrazo.' },
  'Dumbbell_Flyes': { es:'Aperturas con mancuernas', musc:'Pecho', equip:'Mancuernas',
    setup:'Banco plano, mancuernas arriba del pecho con codos apenas flexionados.',
    tip:'Abrí en arco hasta la altura del pecho, subí juntando. No bajes de más.' },

  // ---------- TRÍCEPS ----------
  'Triceps_Pushdown': { es:'Extensión de tríceps en polea (barra)', musc:'Tríceps', equip:'Polea alta',
    setup:'Polea en alto con barra recta. Codos pegados al cuerpo, dá un paso atrás.',
    tip:'Estirá los codos hacia abajo del todo, subí sin despegar los codos.' },
  'Triceps_Pushdown_-_Rope_Attachment': { es:'Extensión de tríceps en polea (cuerda)', musc:'Tríceps', equip:'Polea alta',
    setup:'Polea en alto con cuerda. Codos al costado del torso.',
    tip:'Al final abrí la cuerda hacia afuera para apretar más el tríceps.' },
  'Cable_Rope_Overhead_Triceps_Extension': { es:'Extensión de tríceps sobre la cabeza (cuerda)', musc:'Tríceps', equip:'Polea',
    setup:'Polea baja o media con cuerda. Dá la espalda a la polea, cuerda por detrás de la cabeza, codos apuntando al frente.',
    tip:'Estirá hacia adelante-arriba. Mantené los codos quietos y altos.' },
  'EZ-Bar_Skullcrusher': { es:'Rompecráneos con barra Z', musc:'Tríceps', equip:'Barra Z',
    setup:'Banco plano, barra Z sobre el pecho con brazos estirados.',
    tip:'Bajá la barra hacia la frente flexionando solo los codos, luego estirá.' },
  'Standing_Dumbbell_Triceps_Extension': { es:'Extensión de tríceps con mancuerna', musc:'Tríceps', equip:'Mancuerna',
    setup:'De pie o sentado, una mancuerna con ambas manos por detrás de la cabeza.',
    tip:'Codos altos y quietos. Estirá hacia arriba controlando la bajada.' },
  'Reverse_Grip_Triceps_Pushdown': { es:'Extensión de tríceps agarre invertido', musc:'Tríceps', equip:'Polea alta',
    setup:'Polea en alto con barra recta, agarre con palmas hacia arriba (supino).',
    tip:'Foco en la cabeza interna del tríceps. Codos pegados al cuerpo.' },

  // ---------- ESPALDA ----------
  'Wide-Grip_Lat_Pulldown': { es:'Jalón al pecho agarre ancho', musc:'Espalda (dorsales)', equip:'Polea alta',
    setup:'Ajustá la rodillera para que las piernas queden fijas. Agarre ancho de la barra, palmas al frente.',
    tip:'Llevá la barra al pecho alto sacando pecho, codos hacia abajo. Volvé estirando bien.' },
  'Close-Grip_Front_Lat_Pulldown': { es:'Jalón al pecho agarre cerrado', musc:'Espalda (dorsales)', equip:'Polea alta',
    setup:'Ajustá la rodillera. Usá el triángulo o agarre angosto.',
    tip:'Tirá al pecho apretando la espalda media. Pecho arriba.' },
  'Seated_Cable_Rows': { es:'Remo sentado en polea', musc:'Espalda', equip:'Polea baja',
    setup:'Sentate con pies en los apoyos y rodillas semiflexionadas. Agarrá el triángulo con la espalda recta.',
    tip:'Tirá hacia el abdomen juntando los omóplatos. No uses impulso de la espalda baja.' },
  'Bent_Over_Barbell_Row': { es:'Remo con barra inclinado', musc:'Espalda', equip:'Barra',
    setup:'De pie, tronco inclinado ~45°, espalda recta, rodillas semiflexionadas. Barra colgando.',
    tip:'Tirá la barra al ombligo/abdomen bajo, codos hacia atrás. Bajá controlando.' },
  'Bent_Over_Two-Dumbbell_Row': { es:'Remo con mancuernas inclinado', musc:'Espalda', equip:'Mancuernas',
    setup:'Tronco inclinado con espalda recta, una mancuerna en cada mano colgando.',
    tip:'Remá ambas mancuernas hacia la cadera apretando la espalda.' },

  // ---------- BÍCEPS ----------
  'Barbell_Curl': { es:'Curl de bíceps con barra', musc:'Bíceps', equip:'Barra',
    setup:'De pie, barra con agarre a la anchura de hombros, palmas al frente. Codos pegados al torso.',
    tip:'Subí sin balancear el cuerpo, apretá arriba y bajá lento.' },
  'EZ-Bar_Curl': { es:'Curl con barra Z', musc:'Bíceps', equip:'Barra Z',
    setup:'De pie con barra Z, agarre en las curvas (más cómodo para las muñecas).',
    tip:'Codos quietos. Subí y bajá sin usar impulso.' },
  'Hammer_Curls': { es:'Curl martillo', musc:'Bíceps / Antebrazo', equip:'Mancuernas',
    setup:'De pie, mancuernas a los costados con agarre neutro (palmas enfrentadas).',
    tip:'Subí como si martillaras, muñeca firme. Trabaja el braquial y antebrazo.' },
  'Alternate_Hammer_Curl': { es:'Curl martillo alternado', musc:'Bíceps / Antebrazo', equip:'Mancuernas',
    setup:'De pie, agarre neutro, alternás un brazo por vez.',
    tip:'Controlá la bajada de cada brazo. Sin balanceo del torso.' },
  'Cable_Hammer_Curls_-_Rope_Attachment': { es:'Curl martillo en polea (cuerda)', musc:'Bíceps', equip:'Polea baja',
    setup:'Polea baja con cuerda, agarre neutro. Codos pegados al cuerpo.',
    tip:'Tensión constante: no aflojes abajo. Apretá arriba.' },

  // ---------- PIERNAS ----------
  'Barbell_Squat': { es:'Sentadilla con barra', musc:'Cuádriceps / Glúteos', equip:'Barra + rack',
    setup:'Ajustá el rack a la altura del pecho. Barra apoyada sobre los trapecios, pies a la anchura de hombros, puntas levemente afuera.',
    tip:'Bajá sacando la cola atrás hasta que los muslos queden paralelos. Rodillas siguiendo la punta de los pies.' },
  'Leg_Press': { es:'Prensa de piernas', musc:'Cuádriceps / Glúteos', equip:'Máquina',
    setup:'Sentate con la espalda y cola bien apoyadas. Pies en la plataforma a la anchura de hombros, media altura.',
    tip:'Bajá hasta ~90° sin despegar la cola. Empujá con los talones sin bloquear de golpe las rodillas.' },
  'Narrow_Stance_Leg_Press': { es:'Prensa pies juntos', musc:'Cuádriceps', equip:'Máquina',
    setup:'Igual que la prensa pero con los pies juntos y bajos en la plataforma.',
    tip:'Mayor foco en el cuádriceps externo. Rango completo y controlado.' },
  'Leg_Extensions': { es:'Extensión de cuádriceps', musc:'Cuádriceps', equip:'Máquina',
    setup:'Espalda contra el respaldo. Ajustá el rodillo para que quede sobre los tobillos y el eje a la altura de la rodilla.',
    tip:'Estirá las piernas apretando el cuádriceps arriba, bajá lento.' },
  'Lying_Leg_Curls': { es:'Curl femoral acostado', musc:'Femoral', equip:'Máquina',
    setup:'Boca abajo, rodillo sobre la parte de atrás de los tobillos, eje a la altura de la rodilla.',
    tip:'Llevá los talones a la cola apretando el femoral. Bajá controlando.' },
  'Seated_Leg_Curl': { es:'Curl femoral sentado', musc:'Femoral', equip:'Máquina',
    setup:'Sentate con el rodillo sobre la parte baja de las pantorrillas y el apoyo sobre los muslos.',
    tip:'Flexioná llevando los talones hacia abajo-atrás. Apretá y volvé lento.' },
  'Romanian_Deadlift': { es:'Peso muerto rumano', musc:'Femoral / Glúteos', equip:'Barra',
    setup:'De pie con la barra pegada a los muslos, agarre a la anchura de hombros, rodillas apenas flexionadas.',
    tip:'Llevá la cola atrás bajando la barra pegada a las piernas hasta sentir el femoral. Espalda recta siempre.' },
  'Standing_Calf_Raises': { es:'Elevación de gemelos de pie', musc:'Gemelos', equip:'Máquina',
    setup:'Hombros bajo las almohadillas, punta de los pies en la plataforma, talones al aire.',
    tip:'Subí lo más alto posible en punta de pie, bajá estirando bien el gemelo.' },
  'Calf_Press': { es:'Gemelos en prensa', musc:'Gemelos', equip:'Máquina',
    setup:'En la prensa, apoyá solo la punta de los pies en el borde inferior de la plataforma.',
    tip:'Empujá con las puntas estirando el tobillo, volvé estirando el gemelo. No bloquees rodillas.' },

  // ---------- HOMBROS ----------
  'Dumbbell_Shoulder_Press': { es:'Press de hombros con mancuernas', musc:'Hombros', equip:'Mancuernas',
    setup:'Sentate con respaldo. Mancuernas a la altura de las orejas, codos abajo.',
    tip:'Empujá arriba sin bloquear de golpe. Bajá controlando hasta las orejas.' },
  'Standing_Dumbbell_Press': { es:'Press militar de pie con mancuernas', musc:'Hombros', equip:'Mancuernas',
    setup:'De pie, abdomen firme, mancuernas a la altura de los hombros.',
    tip:'Empujá arriba sin arquear la espalda baja. Core apretado.' },
  'Smith_Machine_Overhead_Shoulder_Press': { es:'Press de hombros en máquina Smith', musc:'Hombros', equip:'Smith',
    setup:'Banco con respaldo bajo la barra del Smith, barra a la altura de la clavícula.',
    tip:'Empujá recto arriba y bajá controlando. Ideal para empezar con más seguridad.' },
  'Side_Lateral_Raise': { es:'Elevaciones laterales', musc:'Hombro lateral', equip:'Mancuernas',
    setup:'De pie, mancuernas a los costados, codos apenas flexionados.',
    tip:'Subí a los costados hasta la altura de los hombros, meñiques un poco arriba. Bajá lento.' },
  'Front_Dumbbell_Raise': { es:'Elevaciones frontales', musc:'Hombro anterior', equip:'Mancuernas',
    setup:'De pie, mancuernas apoyadas al frente de los muslos.',
    tip:'Subí al frente hasta la altura de los ojos, sin impulso. Alterná o juntas.' },
  'Face_Pull': { es:'Face pull (jalón a la cara)', musc:'Hombro posterior', equip:'Polea alta',
    setup:'Polea a la altura de la cara con cuerda. Dá un paso atrás y agarrá con palmas hacia adentro.',
    tip:'Tirá hacia la frente abriendo la cuerda, codos altos. Apretá la parte de atrás del hombro.' },
  'Reverse_Machine_Flyes': { es:'Aperturas invertidas en máquina', musc:'Hombro posterior', equip:'Máquina',
    setup:'Sentate mirando la máquina (pecho contra el respaldo). Manijas al frente a la altura de los hombros.',
    tip:'Abrí los brazos hacia atrás apretando la parte posterior del hombro.' },
  'Cable_Rear_Delt_Fly': { es:'Aperturas posteriores en polea', musc:'Hombro posterior', equip:'Poleas',
    setup:'Poleas cruzadas a la altura de los hombros, agarrás la manija opuesta con cada mano.',
    tip:'Abrí en cruz hacia atrás, sin usar la espalda. Foco en el deltoides posterior.' },
};

/* Warmup (calentamiento) por día */
const WARM = {
  torso: ['5 min de bici o elíptico suave', 'Círculos de brazos y hombros 30 s', '1 serie liviana del primer ejercicio (15 reps)'],
  pierna: ['5 min de bici o caminadora', 'Sentadillas sin peso 15 reps', 'Movilidad de cadera y tobillo 1 min', '1 serie liviana de sentadilla/prensa'],
};

/* ============================================================
   RUTINA · 4 días · sin abdomen
   Cada ejercicio: opts (alternativas para cambiar), sets, reps,
   rest (seg), lb (peso inicial sugerido en libras, editable),
   inc (cuánto subir cuando fue "fácil")
   ============================================================ */
const ROUTINE = {
  version: 1,
  title: 'Rutina de Hipertrofia · 4 días',
  days: [
    {
      id: 'd1', name: 'Día 1', focus: 'Pecho y Tríceps', emoji: '💪', warm: 'torso',
      exercises: [
        { key:'d1e1', name:'Press de pecho', opts:['Barbell_Bench_Press_-_Medium_Grip','Dumbbell_Bench_Press','Machine_Bench_Press'], sets:4, reps:'8–12', rest:120, lb:45, inc:10 },
        { key:'d1e2', name:'Press inclinado', opts:['Incline_Dumbbell_Press','Machine_Bench_Press'], sets:3, reps:'10–12', rest:90, lb:25, inc:5 },
        { key:'d1e3', name:'Aperturas / Contractora', opts:['Butterfly','Cable_Crossover','Dumbbell_Flyes'], sets:3, reps:'12–15', rest:75, lb:40, inc:5 },
        { key:'d1e4', name:'Extensión de tríceps en polea', opts:['Triceps_Pushdown','Triceps_Pushdown_-_Rope_Attachment','Reverse_Grip_Triceps_Pushdown'], sets:4, reps:'10–15', rest:60, lb:30, inc:5 },
        { key:'d1e5', name:'Tríceps sobre la cabeza', opts:['EZ-Bar_Skullcrusher','Cable_Rope_Overhead_Triceps_Extension','Standing_Dumbbell_Triceps_Extension'], sets:3, reps:'10–12', rest:75, lb:30, inc:5 },
      ],
    },
    {
      id: 'd2', name: 'Día 2', focus: 'Espalda y Bíceps', emoji: '🔙', warm: 'torso',
      exercises: [
        { key:'d2e1', name:'Jalón al pecho', opts:['Wide-Grip_Lat_Pulldown','Close-Grip_Front_Lat_Pulldown'], sets:4, reps:'10–12', rest:90, lb:50, inc:10 },
        { key:'d2e2', name:'Remo sentado en polea', opts:['Seated_Cable_Rows','Bent_Over_Two-Dumbbell_Row'], sets:4, reps:'10–12', rest:90, lb:50, inc:10 },
        { key:'d2e3', name:'Remo con barra/mancuernas', opts:['Bent_Over_Barbell_Row','Bent_Over_Two-Dumbbell_Row'], sets:3, reps:'8–12', rest:90, lb:45, inc:5 },
        { key:'d2e4', name:'Curl con barra', opts:['Barbell_Curl','EZ-Bar_Curl'], sets:4, reps:'8–12', rest:60, lb:30, inc:5 },
        { key:'d2e5', name:'Curl martillo', opts:['Hammer_Curls','Alternate_Hammer_Curl','Cable_Hammer_Curls_-_Rope_Attachment'], sets:3, reps:'10–12', rest:60, lb:15, inc:5 },
      ],
    },
    {
      id: 'd3', name: 'Día 3', focus: 'Piernas', emoji: '🦵', warm: 'pierna',
      exercises: [
        { key:'d3e1', name:'Sentadilla / Prensa', opts:['Barbell_Squat','Leg_Press'], sets:4, reps:'8–12', rest:150, lb:45, inc:10 },
        { key:'d3e2', name:'Prensa de piernas', opts:['Leg_Press','Narrow_Stance_Leg_Press'], sets:4, reps:'10–15', rest:120, lb:90, inc:10 },
        { key:'d3e3', name:'Extensión de cuádriceps', opts:['Leg_Extensions'], sets:3, reps:'12–15', rest:75, lb:40, inc:10 },
        { key:'d3e4', name:'Curl femoral', opts:['Lying_Leg_Curls','Seated_Leg_Curl'], sets:4, reps:'10–12', rest:75, lb:40, inc:10 },
        { key:'d3e5', name:'Peso muerto rumano', opts:['Romanian_Deadlift'], sets:3, reps:'10–12', rest:120, lb:45, inc:10 },
        { key:'d3e6', name:'Gemelos', opts:['Standing_Calf_Raises','Calf_Press'], sets:4, reps:'15–20', rest:60, lb:60, inc:10 },
      ],
    },
    {
      id: 'd4', name: 'Día 4', focus: 'Hombros y Brazos', emoji: '🏔️', warm: 'torso',
      exercises: [
        { key:'d4e1', name:'Press de hombros', opts:['Dumbbell_Shoulder_Press','Standing_Dumbbell_Press','Smith_Machine_Overhead_Shoulder_Press'], sets:4, reps:'8–12', rest:90, lb:20, inc:5 },
        { key:'d4e2', name:'Elevaciones laterales', opts:['Side_Lateral_Raise'], sets:4, reps:'12–15', rest:60, lb:10, inc:5 },
        { key:'d4e3', name:'Hombro posterior', opts:['Face_Pull','Reverse_Machine_Flyes','Cable_Rear_Delt_Fly'], sets:3, reps:'12–20', rest:60, lb:25, inc:5 },
        { key:'d4e4', name:'Elevaciones frontales', opts:['Front_Dumbbell_Raise'], sets:3, reps:'12–15', rest:60, lb:10, inc:5 },
        { key:'d4e5', name:'Curl de bíceps', opts:['EZ-Bar_Curl','Barbell_Curl','Cable_Hammer_Curls_-_Rope_Attachment'], sets:3, reps:'10–12', rest:60, lb:30, inc:5 },
        { key:'d4e6', name:'Tríceps en polea', opts:['Triceps_Pushdown_-_Rope_Attachment','Triceps_Pushdown','Reverse_Grip_Triceps_Pushdown'], sets:3, reps:'12–15', rest:60, lb:30, inc:5 },
      ],
    },
  ],
};
