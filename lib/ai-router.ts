import { Settings } from '@/types';
import { AIModel } from '@/types';
import { callClaude } from './ai/claude';
import { callOpenAI } from './ai/openai';
import { callGemini } from './ai/gemini';

export async function callAI(
  model: AIModel,
  prompt: string,
  settings: Settings,
  system?: string
): Promise<string> {
  switch (model) {
    case 'claude':
      if (!settings.anthropic_api_key) throw new Error('Anthropic API key chưa được cấu hình');
      return callClaude(settings.anthropic_api_key, prompt, system);
    case 'gpt4o':
      if (!settings.openai_api_key) throw new Error('OpenAI API key chưa được cấu hình');
      return callOpenAI(settings.openai_api_key, prompt, system);
    case 'gemini':
      if (!settings.gemini_api_key) throw new Error('Gemini API key chưa được cấu hình');
      return callGemini(settings.gemini_api_key, prompt, system);
    default:
      throw new Error(`AI model không hợp lệ: ${model}`);
  }
}

export async function callAIStream(
  model: AIModel,
  prompt: string,
  settings: Settings,
  system?: string
): Promise<ReadableStream<Uint8Array>> {
  switch (model) {
    case 'claude':
      if (!settings.anthropic_api_key) throw new Error('Anthropic API key chưa được cấu hình');
      return callClaude(settings.anthropic_api_key, prompt, system, true);
    case 'gpt4o':
      if (!settings.openai_api_key) throw new Error('OpenAI API key chưa được cấu hình');
      return callOpenAI(settings.openai_api_key, prompt, system, true);
    case 'gemini':
      // Gemini doesn't support streaming yet in this setup, fallback to non-streaming
      if (!settings.gemini_api_key) throw new Error('Gemini API key chưa được cấu hình');
      const text = await callGemini(settings.gemini_api_key, prompt, system);
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });
    default:
      throw new Error(`AI model không hợp lệ: ${model}`);
  }
}
