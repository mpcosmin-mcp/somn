import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry } from '@/lib/sleep';
import { TOOL_DEFINITIONS, executeTool, buildSystemPrompt } from '@/lib/ai-tools';

/**
 * POST /api/chat
 * Body: {
 *   user: string,
 *   messages: { role: 'user'|'assistant', content: string }[],
 *   entries: SleepEntry[],
 * }
 * Returns: {
 *   text: string,                    // final assistant message
 *   mutated: boolean,                // true if any write tool was called
 *   actions: { label: string }[],    // action chips for the chat UI
 *   usage: { in, out },
 * }
 *
 * Agentic loop: AI may call save_sleep / delete_sleep tools to write data.
 * After every tool execution, results are fed back to the model and it
 * continues until it produces a final text turn.
 *
 * Safety: loop bounded at 6 iterations; tools are scoped to the current user.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ReqBody {
  user: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  entries: SleepEntry[];
}

interface ChatAction { label: string }

export async function POST(req: NextRequest) {
  try {
    const { user, messages, entries } = (await req.json()) as ReqBody;

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ text: 'AI offline — adaugă ANTHROPIC_API_KEY în Vercel.', mutated: false, actions: [] });
    }
    if (!user || !messages?.length) {
      return NextResponse.json({ text: '', mutated: false, actions: [] });
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const system = buildSystemPrompt(user, entries);

    // Agent conversation state (Anthropic format with tool_use/tool_result blocks)
    const convo: Anthropic.MessageParam[] = messages
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    let mutated = false;
    const actions: ChatAction[] = [];
    let totalIn = 0;
    let totalOut = 0;

    // Loop until the model stops calling tools (max 6 iterations as safety)
    for (let iter = 0; iter < 6; iter++) {
      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 700,
        system,
        tools: TOOL_DEFINITIONS,
        messages: convo,
      });

      totalIn += response.usage.input_tokens;
      totalOut += response.usage.output_tokens;

      // Tool use → execute every tool block, then loop
      if (response.stop_reason === 'tool_use') {
        // Add assistant's tool_use turn to history
        convo.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          const exec = await executeTool({
            toolUseId: block.id,
            toolName: block.name,
            input: block.input as Record<string, unknown>,
            user,
            entries,
          });
          if (exec.mutated) mutated = true;
          if (exec.actionLabel) actions.push({ label: exec.actionLabel });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: exec.toolUseId,
            content: exec.resultContent,
            is_error: exec.isError,
          });
        }

        // Feed tool results back as a "user" turn
        convo.push({ role: 'user', content: toolResults });
        continue;
      }

      // No more tools — final assistant message
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();

      return NextResponse.json({
        text,
        mutated,
        actions,
        usage: { in: totalIn, out: totalOut },
      });
    }

    return NextResponse.json({
      text: 'Am rămas blocat într-o buclă de tool-uri. Reîncearcă întrebarea mai simplu.',
      mutated,
      actions,
      usage: { in: totalIn, out: totalOut },
    });
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json(
      {
        text: 'Eroare la generare. Încearcă din nou.',
        mutated: false,
        actions: [],
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 200 },
    );
  }
}
