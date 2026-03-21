import type { Env } from './index';
import { corsHeaders } from './index';
import type { Auth } from './auth';

const NUTRITION_PROMPT = `You are a nutrition analysis assistant. Analyse this food or drink image.
Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation outside the JSON:
{
  "name": "short descriptive name of the food or drink",
  "description": "what you see including estimated portion size",
  "calories": <integer kcal>,
  "protein_g": <number, grams>,
  "carbs_g": <number, grams>,
  "fat_g": <number, grams>,
  "confidence": <integer 0-100>,
  "notes": "any caveats or assumptions about the estimate"
}
If the image contains no food or drink, return exactly: { "error": "no_food_detected" }`;

export interface SnapResult {
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  notes: string;
}

export async function handleSnap(
  request: Request,
  env: Env,
  origin: string,
  auth: Auth,
): Promise<Response> {
  console.log('Worker: Received snap request');
  const session = await auth.api.getSession({ headers: request.headers }).catch((e) => {
    console.error('Worker: Session check failed', e);
    return null;
  });
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json() as { imageBase64: string; mimeType: string };

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!body.imageBase64 || !allowedTypes.includes(body.mimeType)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  }

  let raw = '';
  try {
    console.log('Worker: Starting AI run with model @cf/meta/llama-3.2-11b-vision-instruct');
    const result = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct' as any, {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${body.mimeType};base64,${body.imageBase64}` },
            },
            { type: 'text', text: NUTRITION_PROMPT },
          ],
        },
      ],
    } as Parameters<typeof env.AI.run>[1]);

    raw = ((result as { response: string }).response ?? '').trim();
    console.log('Worker: AI Response received', { length: raw.length, rawPreview: raw.slice(0, 100) });

    // Try to extract JSON from the response, even if wrapped in markdown or extra text
    let parsed: Record<string, unknown>;
    try {
      // First try: strip markdown code fences and parse directly
      const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      // Fallback: find the first { ... } JSON object in the response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Workers AI snap: no JSON found in response:', raw);
        return new Response(JSON.stringify({ error: 'vision_failed', detail: 'No JSON in AI response' }), {
          status: 502,
          headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
        });
      }
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    }

    if (parsed['error'] === 'no_food_detected') {
      return new Response(JSON.stringify({ error: 'no_food_detected' }), {
        status: 422,
        headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
      });
    }

    const snap: SnapResult = {
      name:        String(parsed['name'] ?? 'Unknown food'),
      description: String(parsed['description'] ?? ''),
      calories:    Math.round(Number(parsed['calories']) || 0),
      protein_g:   Math.round(Number(parsed['protein_g']) || 0),
      carbs_g:     Math.round(Number(parsed['carbs_g']) || 0),
      fat_g:       Math.round(Number(parsed['fat_g']) || 0),
      confidence:  Math.min(100, Math.max(0, Math.round(Number(parsed['confidence']) || 50))),
      notes:       String(parsed['notes'] ?? ''),
    };

    console.log('Worker: Returning snap result', snap.name);

    return new Response(JSON.stringify(snap), {
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Workers AI snap error:', err, 'raw response:', raw);
    return new Response(JSON.stringify({ error: 'vision_failed' }), {
      status: 500,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  }
}
