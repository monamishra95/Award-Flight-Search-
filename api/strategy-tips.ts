/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Serverless Function — proxies the Gemini API call.
 *
 * GEMINI_API_KEY is read from process.env on the server only. It is set as
 * an environment variable in the Vercel project dashboard (or via
 * `vercel env add GEMINI_API_KEY`) and is NEVER bundled into client-side
 * JavaScript. This is the fix for the key-exposure issue in the original
 * client-side implementation (see README "Security" section).
 */
import { GoogleGenAI, Type } from '@google/genai';

// Vercel injects req/res with Node's IncomingMessage/ServerResponse shape.
// Typed loosely here to avoid requiring @vercel/node as a dependency.
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
    const { origin, destination, depDate, program } = req.body || {};

    if (!origin || !destination || !depDate || !program) {
      res.status(400).json({ error: 'Missing required fields: origin, destination, depDate, program.' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `I am flying from ${origin} to ${destination} on ${depDate} using ${program} points. Provide exactly 3 short, highly strategic tips for maximizing award travel on this specific route. Return the response as a strict JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
