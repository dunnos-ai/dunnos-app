// Modelo usado para generar los SVG. Generar SVG es "dibujar con código",
// así que un modelo más capaz mejora mucho la calidad.
//   'claude-sonnet-5'  → salto grande de calidad sobre Sonnet 4.6, rápido (menos timeouts). DEFAULT.
//   'claude-opus-4-8'  → máxima calidad, pero más lento (cuidado con el timeout de Netlify).
// Las imágenes se generan una sola vez y se cachean, así que puedes probar ambos.
const MODEL = 'claude-sonnet-5';

const MASTER_SYSTEM = `You are the Official Illustration Engine for DUNNOS AI.

Your job is to create the world's most consistent educational illustration library for English vocabulary learning.

PRIMARY OBJECTIVE: The learner should recognize the intended meaning instantly. Recognition is always more important than artistic creativity. Clarity is mandatory.

CONCEPT INTERPRETATION — Always illustrate the intended everyday meaning:
- Water → a glass of drinking water. NOT H2O molecule or chemical formula
- Apple → the fruit. NOT Apple Inc or iPhone
- Coffee → a cup of coffee. NOT coffee beans
- Milk → a glass of milk. NOT a cow
- Never illustrate scientific, symbolic, technical or abstract interpretations

VISUAL STYLE: Premium editorial flat illustration. Mid-century modern. Scandinavian minimalism. Clean vector. Geometric. Timeless. Never cartoon, never anime, never Pixar, never Disney, never clipart, never emoji, never realistic, never 3D.

COMPOSITION: Square canvas. Single primary subject. Centered. Occupies 70% of canvas. Large negative space. Never crop the subject.

COLOR: Flat colors only. No gradients. No shadows. No reflections. No textures. Maximum 8 colors.

SILHOUETTE: Must identify subject even filled completely black.

ABSOLUTE PROHIBITIONS:
- No text, no letters, no numbers, no labels, no captions, no watermarks
- No gradients, no shadows, no textures, no 3D, no photorealism
- No anime, no Disney, no Pixar, no clipart, no emoji
- No extra limbs, no extra fingers, no cropped subjects

QUALITY CHECK before finishing:
✓ Is the intended meaning obvious?
✓ Could a 7-year-old identify it?
✓ Is it recognizable in under one second?
✓ Zero text or letters visible?

Return ONLY valid SVG code. Start immediately with <svg. No explanation, no markdown.`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { word, isVerb, bgIndex, show, avoid } = JSON.parse(event.body);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada en Netlify');
    }
    if (!word) {
      throw new Error('Falta la palabra (word)');
    }

    const NOUN_BG = ["#E8F4F8","#FFF8E7","#F0F7EE","#FFF0F5","#F5F0FF","#FFFBF0","#F0F8F0","#FEF9F0","#F0F4FE","#FFF5F5"];
    const VERB_BG = ["#1A1A2E","#16213E","#0F3460","#1B2A4A","#0D1B2A","#1C1C3A"];
    const bg = isVerb ? VERB_BG[(bgIndex||0) % VERB_BG.length] : NOUN_BG[(bgIndex||0) % NOUN_BG.length];

    const avoidStr = (avoid && avoid.length) ? `\nNEVER illustrate: ${avoid.join(', ')}` : '';

    const prompt = isVerb
      ? `Category: Verb
Action word: ${word}
Illustrate: ${show || 'a person actively performing the action "'+word+'"'}
Background: Solid Navy ${bg}
Accent color: #00FF01 for motion lines only — never dominant${avoidStr}
One adult person. Dynamic exaggerated pose. Entire body visible. Strong silhouette.
400x400 SVG.`
      : `Category: Word (vocabulary flashcard)
Concept: ${word}
Illustrate EXACTLY: ${show || word}
Background: Solid pastel ${bg}${avoidStr}
One object, centered, large, instantly recognizable.
400x400 SVG.`;

    // Llamada directa a la API (sin SDK) — evita problemas de bundling en Netlify
    // y mantiene el mismo patrón que las otras funciones del proyecto.
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        // Alto para que los SVG detallados no se corten a mitad de camino
        // (era 3000: causaba fallos intermitentes en objetos complejos).
        max_tokens: 8000,
        system: MASTER_SYSTEM,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    // Si la API respondió con error (rate limit, key inválida, etc.), propágalo claro
    if (!response.ok || data.error) {
      const msg = data.error?.message || `HTTP ${response.status}`;
      throw new Error(`API: ${msg}`);
    }

    // Extraer el texto de forma segura (busca el primer bloque de texto)
    const textBlock = Array.isArray(data.content)
      ? data.content.find(b => b.type === 'text')
      : null;
    let svg = (textBlock?.text || '').trim();

    // Si se agotó el presupuesto de tokens, el SVG viene truncado
    if (data.stop_reason === 'max_tokens') {
      throw new Error('SVG truncado (max_tokens) — sube max_tokens o simplifica el prompt');
    }

    // Extract SVG
    const match = svg.match(/<svg[\s\S]*<\/svg>/i);
    if (!match) throw new Error('No se encontró SVG en la respuesta del modelo');
    svg = match[0];
    
    // Remove any text elements
    svg = svg
      .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
      .replace(/<tspan[^>]*>[\s\S]*?<\/tspan>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc>[\s\S]*?<\/desc>/gi, '');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ svg, bg })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
