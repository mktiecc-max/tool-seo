import Anthropic from '@anthropic-ai/sdk';

const RETRY_DELAYS = [2000, 4000];
const RETRYABLE_STATUS = [429, 500, 502, 503];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callClaude(
  apiKey: string,
  prompt: string,
  system?: string,
  stream?: false
): Promise<string>;
export async function callClaude(
  apiKey: string,
  prompt: string,
  system: string | undefined,
  stream: true
): Promise<ReadableStream<Uint8Array>>;
export async function callClaude(
  apiKey: string,
  prompt: string,
  system?: string,
  stream?: boolean
): Promise<string | ReadableStream<Uint8Array>> {
  const client = new Anthropic({ apiKey });

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream<Uint8Array>({
          async start(controller) {
            const streamResponse = await client.messages.stream({
              model: 'claude-opus-4-5',
              max_tokens: 8192,
              system: system || 'You are a helpful assistant.',
              messages: [{ role: 'user', content: prompt }],
            });
            for await (const chunk of streamResponse) {
              if (
                chunk.type === 'content_block_delta' &&
                chunk.delta.type === 'text_delta'
              ) {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }
            controller.close();
          },
        });
        return readable;
      }

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 8192,
        system: system || 'You are a helpful assistant.',
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content[0];
      if (block.type === 'text') return block.text;
      throw new Error('Unexpected response type from Claude');
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (attempt < RETRY_DELAYS.length && (!status || RETRYABLE_STATUS.includes(status))) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Claude: max retries exceeded');
}
