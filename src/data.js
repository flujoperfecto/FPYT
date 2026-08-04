export const channelUrl = 'https://www.youtube.com/channel/UC2vUmW2oCGDGo2hooHMv09A';

export const resources = [
  {
    id: 'oferta-que-convierte',
    type: 'Prompt',
    title: 'Diseña una oferta que la gente entienda',
    description: 'Convierte una idea difusa en una oferta concreta, comprobable y fácil de explicar.',
    meta: '8 min · Copiar y usar',
    tag: 'Negocios',
    featured: true,
    content: `Actúa como estratega de producto. Ayúdame a transformar mi idea en una oferta clara y validable.

Idea: [describe tu idea]
Usuario ideal: [quién tiene el problema]
Resultado prometido: [qué cambia para esa persona]

Entrega:
1. El problema en una frase, sin jerga.
2. La propuesta de valor con esta estructura: «Ayudo a [usuario] a [resultado] sin [fricción principal]».
3. Tres objeciones probables y cómo resolverlas.
4. Una prueba mínima que pueda ejecutar en 48 horas.
5. Una llamada a la acción específica.

No inventes datos. Señala cada supuesto que necesite validación.`
  },
  {
    id: 'investigador-oportunidades',
    type: 'Skill',
    title: 'Investigador de oportunidades',
    description: 'Una skill base para investigar problemas, señales de demanda y huecos de mercado.',
    meta: 'SKILL.md · v1.0',
    tag: 'Agentes',
    content: `---
name: investigador-oportunidades
description: Investiga una oportunidad antes de construir un producto.
---

# Objetivo
Encontrar evidencia útil para decidir si una idea merece una prueba.

# Flujo
1. Define usuario, contexto y problema.
2. Busca señales de dolor y soluciones actuales.
3. Separa hechos, inferencias y suposiciones.
4. Resume alternativas y huecos observables.
5. Propón una prueba pequeña, barata y reversible.

# Salida
Entrega una tabla de evidencias y una recomendación: avanzar, reformular o descartar.`
  },
  {
    id: 'app-fin-semana',
    type: 'Instrucción',
    title: 'De idea a app en un fin de semana',
    description: 'El procedimiento que uso para recortar alcance, construir y publicar una primera versión.',
    meta: '7 pasos · Checklist',
    tag: 'Vibe coding',
    content: `1. Escribe el resultado único que debe lograr la app.
2. Elige un solo tipo de usuario y una sola acción principal.
3. Dibuja tres pantallas: entrada, trabajo y resultado.
4. Define los datos mínimos y elimina todo lo que no sea esencial.
5. Construye primero el recorrido feliz de principio a fin.
6. Prueba con tres personas y registra dónde se detienen.
7. Publica, mide una señal útil y decide la siguiente iteración.

Regla: si una función no ayuda a completar la acción principal, va al backlog.`
  },
  {
    id: 'agente-con-controles',
    type: 'Prompt',
    title: 'Arquitecta un agente con controles',
    description: 'Define objetivo, contexto, herramientas, límites y puntos de aprobación humana.',
    meta: '12 min · Copiar y adaptar',
    tag: 'Agentes',
    content: `Diseña la especificación de un agente para esta tarea: [tarea].

Antes de proponer la solución, pregunta por la información crítica que falte. Luego entrega:
- Objetivo medible y condición de término.
- Contexto que recibirá en cada ejecución.
- Herramientas necesarias y para qué puede usar cada una.
- Acciones prohibidas.
- Decisiones que requieren aprobación humana.
- Manejo de errores y estrategia de recuperación.
- Registro mínimo para poder auditar resultados.
- Cinco casos de prueba, incluyendo entradas ambiguas y fallos.

Prioriza seguridad, reversibilidad y trazabilidad sobre autonomía total.`
  },
  {
    id: 'claude-maestro',
    type: 'Curso',
    title: 'Claude: de cero a maestro',
    description: 'Chat, Cowork, Code y Design conectados en un flujo completo de creación.',
    meta: 'Curso completo · En preparación',
    tag: 'Claude',
    content: 'La ruta completa para pasar de una conversación con Claude a un sistema de trabajo capaz de investigar, construir y documentar proyectos reales.'
  },
  {
    id: 'stack-publicacion',
    type: 'Enlace',
    title: 'Stack mínimo para publicar',
    description: 'Las piezas que necesitas para pasar de un prototipo local a una URL compartible.',
    meta: 'Colección · 5 herramientas',
    tag: 'Herramientas',
    content: 'Una selección comentada de herramientas para código, datos, analítica, publicación y captura de feedback. La colección se actualizará junto a los videos del canal.'
  }
];

export const chapters = [
  {
    time: '00:00',
    title: 'Empieza por el problema',
    description: 'Cómo convertir una idea amplia en una acción concreta que alguien quiera completar.',
    resource: resources[0]
  },
  {
    time: '08:24',
    title: 'Diseña el sistema',
    description: 'Define datos, decisiones, herramientas y puntos de control antes de escribir código.',
    resource: resources[3]
  },
  {
    time: '19:10',
    title: 'Construye el recorrido feliz',
    description: 'La forma más rápida de conseguir una versión completa que ya pueda probarse.',
    resource: resources[2]
  },
  {
    time: '31:42',
    title: 'Publica y aprende',
    description: 'Pon el producto frente a usuarios reales y convierte su comportamiento en decisiones.',
    resource: resources[5]
  }
];
