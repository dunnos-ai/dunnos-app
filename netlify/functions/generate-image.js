const Anthropic = require('@anthropic-ai/sdk');

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
    const { word, isVerb, bgIndex } = JSON.parse(event.body);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const NOUN_BG = ["#E8F4F8","#FFF8E7","#F0F7EE","#FFF0F5","#F5F0FF","#FFFBF0","#F0F8F0","#FEF9F0","#F0F4FE","#FFF5F5"];
    const VERB_BG = ["#1A1A2E","#16213E","#0F3460","#1B2A4A","#0D1B2A","#1C1C3A"];
    const bg = isVerb ? VERB_BG[bgIndex % VERB_BG.length] : NOUN_BG[bgIndex % NOUN_BG.length];
    const obj = word.replace(/^(A |AN |THE |SOME |MANY )/i, '').trim();

    const system = isVerb
      ? `You are an expert SVG illustrator for DUNNOS AI. Create bold flat illustrations of people performing actions.
RULES: Dark solid background. Person is simple cartoon with clear action pose. Accent: #00FF01 (lime) and white. 
Action must be instantly recognizable. Flat colors, no gradients. viewBox="0 0 400 400". No text. SVG only.`
      : `You are an expert SVG illustrator for DUNNOS AI. Create flat editorial illustrations — mid-century modern poster style.
RULES: Flat colors only. Object large and centered (65% canvas). Bold saturated colors 3-4 max. Solid background.
Clean silhouette. No text. No labels. viewBox="0 0 400 400". SVG only.`;

    const prompt = isVerb
      ? `Background: ${bg}\nDraw a person actively performing "${word}". Clear exaggerated pose. Lime green #00FF01 accents. 400x400 SVG.`
      : `Background: ${bg}\nDraw "${obj}" — large, centered, bold flat editorial illustration. 400x400 SVG.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const match = text.match(/<svg[\s\S]*<\/svg>/i);
    if (!match) throw new Error('No SVG in response');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ svg: match[0], bg })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};
