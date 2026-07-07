/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Serverless Function — proxies the Gemini API call.
 *
 * GEMINI_API_KEY is read from process.env on the server only. It is set as
 * an environment variable in the Vercel project dashboard and is NEVER
 * bundled into client-side JavaScript.
 */
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY is not set.' });
    return;
  }

  try {
    const { origin, destination, depDate, cabins, transfers } = req.body || {};

    if (!origin || !destination || !depDate) {
      res.status(400).json({ error: 'Missing required fields: origin, destination, depDate.' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build a personalized context string from the user's actual points balances
    let pointsContext = '';
    if (transfers && transfers.length > 0) {
      // Group by CC program and summarize top options
      const grouped: Record<string, string[]> = {};
      for (const t of transfers) {
        if (!grouped[t.ccName]) grouped[t.ccName] = [];
        grouped[t.ccName].push(`${t.airline} (${t.miles.toLocaleString()} miles${t.bonus > 0 ? `, includes ${t.bonus * 100}% bonus` : ''})`);
      }
      const lines = Object.entries(grouped).map(([cc, airlines]) => `- ${cc}: ${airlines.join(', ')}`);
      pointsContext = `\n\nThe traveler has the following points and computed transfer options:\n${lines.join('\n')}\n\nUse this information to give specific, actionable advice — recommend the best transfer path for this route if the data supports it.`;
    }

    const cabinContext = cabins && cabins.length > 0
      ? `They are searching in: ${cabins.join(', ')}.`
      : '';

    const prompt = `I am planning an award flight from ${origin} to ${destination}, departing around ${depDate}. ${cabinContext}${pointsContext}

Provide exactly 3 concise, strategic tips for maximizing award travel on this specific route. If points balance data was provided above, reference it directly — name the best transfer path and explain why. If no points data was provided, give general strategic tips for this route.

Return the response as a strict JSON array of 3 strings.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        temperature: 0.4,
      },
    });

    const tips = JSON.parse(response.text || '[]');
    res.status(200).json({ tips });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch AI strategy.' });
  }
}
