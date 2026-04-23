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
  stream?: false
): Promise<string>;
export async function callOpenAI(
  apiKey: string,
  prompt: string,
  system: string | undefined,
  stream: true
): Promise<ReadableStream<Uint8Array>>;
export async function callOpenAI(
  apiKey: string,
  prompt: string,
  system?: string,
  stream?: boolean
): Promise<string | ReadableStream<Uint8Array>> {
  const client = new OpenAI({ apiKey });

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream<Uint8Array>({
          async start(controller) {
            const streamResponse = await client.chat.completions.create({
              model: 'gpt-4o',
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
        model: 'gpt-4o',
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
  prompt: string
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1792x1024',
    quality: 'standard',
    n: 1,
  });
  const url = response.data?.[0]?.url;
  if (!url) throw new Error('DALL-E 3 did not return an image URL');
  return url;
}
