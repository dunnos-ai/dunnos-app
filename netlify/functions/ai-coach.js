// netlify/functions/ai-coach.js
// Proxy seguro para la Anthropic API
// La API key NUNCA sale al navegador — vive solo en variables de entorno de Netlify

exports.handler = async (event) => {
  const body = JSON.parse(event.body || '{}');

  // Verb conversation mode
  if(body.mode === 'verb-question' || body.mode === 'verb-feedback') {
    const { verb, translation, history=[], heard='', verbUsed=false, turn=0, mode } = body;

    let prompt = '';
    if(mode === 'verb-question') {
      const questionTypes = [
        `Ask a simple present tense question using "${verb}"`,
        `Ask about a past experience using "${verb}"`,
        `Ask what they like or don't like related to "${verb}"`,
        `Ask them to describe something using "${verb}"`,
      ];
      const qType = questionTypes[turn % questionTypes.length];
      prompt = `You are a friendly English conversation coach. ${qType}. 
Keep it short (1 sentence), natural, conversational English.
Previous: ${history.slice(-4).map(m=>m.role+': '+m.content).join(' | ')}
Just ask the question. No explanation.`;
    } else {
      prompt = `You are an English coach. Student used verb "${verb}" (${translation}).
Student said: "${heard}"
Did they use the verb correctly: ${verbUsed ? 'YES' : 'NOT CLEARLY'}.
Give ONE sentence of feedback in Spanish + a quick English example using "${verb}".
Be encouraging. Max 2 sentences total.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || (verbUsed ? '¡Muy bien! Great use of the verb.' : `Try using "${verb}" in your answer.`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ tip: text })
    };
  }


  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS — permite llamadas desde tu propio dominio
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { heard, target, phonetic, score } = JSON.parse(event.body);

    // Validación básica
    if (!target) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
    }

    const prompt = `You are an English pronunciation coach for Spanish speakers using the "Método Directo Progresivo" (Direct Progressive Method) by Inglés Individual.

The student was asked to say: "${target}" ${phonetic}
What the speech recognizer heard: "${heard || '(silence)'}"
Pronunciation score: ${score}/100

Give a SHORT, encouraging pronunciation tip in Spanish (2-3 sentences max).
- If score >= 85: Celebrate warmly and give 1 small refinement tip.
- If score 60-84: Identify the main pronunciation mistake and explain how to fix it simply.
- If score < 60: Give the single most important tip to improve, using a Spanish sound analogy if helpful (e.g. "la 'th' en inglés suena como la 'd' suave en 'nada'").

Be warm, specific, and motivating. Never mention grammar or translation.
Write in plain text only — no bullet points, no markdown.`;

    // Llamar a Anthropic con la key del entorno
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,   // ← key segura en Netlify
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ tip: getFallback(score, target) }),
      };
    }

    const tip = data.content?.[0]?.text || getFallback(score, target);
    return { statusCode: 200, headers, body: JSON.stringify({ tip }) };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ tip: 'Sigue practicando. Escucha, observa y repite.' }),
    };
  }
};

function getFallback(score, target) {
  if (score >= 85) return `¡Excelente! Tu pronunciación de "${target}" es muy buena. Sigue así.`;
  if (score >= 60) return `Casi perfecto en "${target}". Escucha el audio una vez más y presta atención a cada sílaba.`;
  return `Escucha "${target}" varias veces antes de hablar. El método directo: imagen → sonido → tu voz.`;
}
