import OpenAI from 'openai';

const RETRY_DELAYS = [2000, 4000];
const RETRYABLE_STATUS = [429, 500, 502, 503];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callOpenAI(
  apiKey: string,
  prompt: string,
  system?: string,
  stream?: false,
  modelVersion?: string
): Promise<string>;
export async function callOpenAI(
  apiKey: string,
  prompt: string,
  system: string | undefined,
  stream: true,
  modelVersion?: string
): Promise<ReadableStream<Uint8Array>>;
export async function callOpenAI(
  apiKey: string,
  prompt: string,
  system?: string,
  stream?: boolean,
  modelVersion?: string
): Promise<string | ReadableStream<Uint8Array>> {
  const client = new OpenAI({ apiKey });
  const model = modelVersion || 'gpt-4o';

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream<Uint8Array>({
          async start(controller) {
            const streamResponse = await client.chat.completions.create({
              model,
              stream: true,
              messages: [
                { role: 'system', content: system || 'You are a helpful assistant.' },
                { role: 'user', content: prompt },
              ],
            });
            for await (const chunk of streamResponse) {
              const text = chunk.choices[0]?.delta?.content || '';
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          },
        });
        return readable;
      }

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system || 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      });
      return response.choices[0].message.content || '';
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (attempt < RETRY_DELAYS.length && (!status || RETRYABLE_STATUS.includes(status))) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw new Error('OpenAI: max retries exceeded');
}

export async function generateImageDALLE3(
  apiKey: string,
  prompt: string,
  size?: string
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const allowedSizes = ['1024x1024', '1792x1024', '1024x1792'] as const;
  type DalleSize = typeof allowedSizes[number];
  const imageSize: DalleSize = allowedSizes.includes(size as DalleSize)
    ? (size as DalleSize)
    : '1792x1024';
  // Use b64_json so image data is embedded (not a temporary URL that expires)
  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    size: imageSize,
    quality: 'standard',
    n: 1,
    response_format: 'b64_json',
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('DALL-E 3 did not return image data');
  return `data:image/png;base64,${b64}`;
}

/**
 * Generate a photorealistic image using gpt-image-1 — the same model ChatGPT uses.
 * Much more realistic than DALL-E 3, especially for people and real scenes.
 */
export async function generateImageGPTImage1(
  apiKey: string,
  prompt: string,
  size?: string
): Promise<string> {
  const client = new OpenAI({ apiKey });
  // gpt-image-1 supported sizes
  const allowedSizes = ['1024x1024', '1536x1024', '1024x1536', 'auto'] as const;
  type GptSize = typeof allowedSizes[number];
  // Map our size codes to gpt-image-1 sizes
  const sizeMap: Record<string, GptSize> = {
    '1792x1024': '1536x1024',
    '1024x1792': '1024x1536',
    '1024x1024': '1024x1024',
  };
  const imageSize: GptSize = sizeMap[size || '1792x1024'] || '1536x1024';

  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: imageSize,
    quality: 'high',
    n: 1,
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-1 did not return image data');
  return `data:image/png;base64,${b64}`;
}

/**
 * Generate a new image inspired by a reference image using gpt-image-1 (image editing/variation).
 * referenceImageBase64: base64-encoded PNG/JPG (without data: prefix)
 * referenceImageMime: e.g. 'image/png'
 */
export async function generateImageFromReference(
  apiKey: string,
  prompt: string,
  referenceImageBase64: string,
  referenceImageMime: string,
  size?: string
): Promise<string> {
  const client = new OpenAI({ apiKey });

  // Convert base64 to a File-like Blob for the API
  const byteCharacters = atob(referenceImageBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: referenceImageMime });
  const file = new File([blob], 'reference.png', { type: referenceImageMime });

  const allowedSizes = ['1024x1024', '1536x1024', '1024x1536'] as const;
  type GptImgSize = typeof allowedSizes[number];
  // Map dalle3 sizes to gpt-image-1 sizes
  const sizeMap: Record<string, GptImgSize> = {
    '1792x1024': '1536x1024',
    '1024x1792': '1024x1536',
    '1024x1024': '1024x1024',
  };
  const imageSize: GptImgSize = sizeMap[size || '1792x1024'] || '1536x1024';

  const response = await client.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size: imageSize,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-1 did not return image data');
  return `data:image/png;base64,${b64}`;
}
