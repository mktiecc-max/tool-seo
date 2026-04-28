import { GoogleGenerativeAI } from '@google/generative-ai';

const RETRY_DELAYS = [2000, 4000];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callGemini(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  modelVersion?: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelVersion || 'gemini-2.0-flash',
    ...(systemInstruction ? { systemInstruction } : {}),
  });

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const retryable = !status || [429, 500, 502, 503].includes(status);
      if (attempt < RETRY_DELAYS.length && retryable) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini: max retries exceeded');
}

export async function generateImageGemini(
  apiKey: string,
  prompt: string
): Promise<string> {
  // Gemini Imagen via REST API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const body = {
    instances: [{ prompt }],
    parameters: { sampleCount: 1 },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini Imagen error ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Gemini Imagen did not return image data');
  return `data:image/png;base64,${b64}`;
}
