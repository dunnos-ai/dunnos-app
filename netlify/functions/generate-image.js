const Anthropic = require('@anthropic-ai/sdk');

const MASTER_SYSTEM = `You are the Official Illustration Engine for DUNNOS AI.

PRIMARY OBJECTIVE: The learner must recognize the intended meaning instantly.

CONCEPT INTERPRETATION — Always illustrate the everyday meaning:
- Water → a glass of drinking water (NEVER H2O molecule)
- Apple → the fruit (NEVER Apple logo)
- Coffee → a cup of coffee (NEVER beans)

VISUAL STYLE: Premium flat editorial illustration. Mid-century modern. Clean vector. Geometric. Never cartoon, never anime, never Pixar, never emoji, never realistic, never 3D.

COMPOSITION: Square canvas 400x400. Single subject centered. Occupies 65-70%. Large negative space.

COLOR: Flat colors only. No gradients. No shadows. No textures. Max 6 colors.

ABSOLUTE PROHIBITIONS: No text, no letters, no numbers, no labels. No gradients. No 3D. No photorealism.

Return ONLY valid SVG. Start with <svg immediately.`;

const PICTOGRAM_SYSTEM = `You are the Official Illustration Engine for DUNNOS AI — Verb Pictogram Style.

STYLE: Olympic pictogram / ISO safety icon / airport wayfinding sign.
Think: Beijing 2008 Olympics icons, London 2012 sports pictograms, airport signs.

RULES:
- Dark solid background fills entire 400x400 canvas
- Single WHITE geometric figure — circles, rectangles, lines ONLY
- NO facial features, NO fingers, NO clothing, NO hair
- NO realistic anatomy — pure geometric abstraction
- The ACTION must be 100% clear from silhouette shape alone
- Optional: #00FF01 lime green for motion lines or speed effect (minimal, 1-2 lines max)
- Zero gradients, zero textures, zero details
- Simple head = circle, body = rectangle, limbs = rectangles/lines

Return ONLY valid SVG. Start with <svg immediately. No text in SVG.`;

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
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const NOUN_BG = ["#E8F4F8","#FFF8E7","#F0F7EE","#FFF0F5","#F5F0FF","#FFFBF0","#F0F8F0","#FEF9F0","#F0F4FE","#FFF5F5"];
    const VERB_BG = ["#1A1A2E","#16213E","#0F3460","#1B2A4A","#0D1B2A","#1C1C3A"];
    const bg = isVerb ? VERB_BG[(bgIndex||0) % VERB_BG.length] : NOUN_BG[(bgIndex||0) % NOUN_BG.length];

    const avoidStr = (avoid && avoid.length) ? `\nNEVER show: ${avoid.join(', ')}` : '';

    const prompt = isVerb
      ? `Background: ${bg}
Verb: "${word}"
Draw an Olympic-style pictogram of a figure performing "${word}".
White geometric figure on dark background.
Head = circle, body = rectangle, limbs = thin rectangles.
The pose must instantly communicate the action "${word}".${avoidStr}
400x400 SVG.`
      : `Background: ${bg}
Illustrate EXACTLY: ${show || word}
One object, centered, large, instantly recognizable.${avoidStr}
400x400 SVG.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: isVerb ? PICTOGRAM_SYSTEM : MASTER_SYSTEM,
      messages: [{ role: 'user', content: prompt }]
    });

    let svg = response.content[0].text.trim();
    const match = svg.match(/<svg[\s\S]*<\/svg>/i);
    if (!match) throw new Error('No SVG in response');
    svg = match[0]
      .replace(/<text[^>]*>[\s\S]*?<\/text>/gi, '')
      .replace(/<tspan[^>]*>[\s\S]*?<\/tspan>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc>[\s\S]*?<\/desc>/gi, '');

    return { statusCode: 200, headers, body: JSON.stringify({ svg, bg }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
