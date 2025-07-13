// @ts-ignore
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatGroq } from "@langchain/groq";
import { GENERATE_REPORT_PROMPT } from "./prompts.js";

/**
 * Parse the LLM generation to extract the report from inside the <report> tag.
 * If the report can not be parsed, the original generation is returned.
 * @param generation The text generation to parse
 * @returns The parsed generation, or the unmodified generation if it cannot be parsed
 */
function parseGeneration(generation: string): string {
  const reportMatch = generation.match(/<report>([\s\S]*?)<\/report>/);
  if (!reportMatch) {
    console.warn(
      "Could not parse report from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
    );
  }
  return reportMatch ? reportMatch[1].trim() : generation;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SAFE_CHUNK_SIZE = 12000; // ~3,000 tokens
function splitIntoSafeChunks(str: string, size: number): string[] {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

export async function generateContentReport(
  state: typeof GeneratePostAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.pageContents?.length) {
    throw new Error(
      "No page contents found. pageContents must be defined to generate a content report.",
    );
  }

  const reportModel = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || (() => { throw new Error('GROQ_MODEL env variable is required'); })(),
    temperature: 0,
  });

  // Flatten all pageContents into a single string
  const fullContent = state.pageContents.join("\n\n");
  // Chunk size: 12000 characters (safe for ~3,000 tokens)
  const chunks: string[] = splitIntoSafeChunks(fullContent, SAFE_CHUNK_SIZE);

  // Generate a report for each chunk
  const chunkReports: string[] = [];
  const TOKENS_PER_MINUTE = 6000;
  const CHARS_PER_TOKEN = 4; // rough estimate
  const MS_PER_MINUTE = 60000;
  let tokensUsedThisMinute = 0;
  let lastRequestTime = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    // Hard check: if chunk is still too large, split further
    const estimatedTokens = Math.ceil(chunk.length / CHARS_PER_TOKEN);
    if (estimatedTokens > TOKENS_PER_MINUTE) {
      const subChunks = splitIntoSafeChunks(chunk, SAFE_CHUNK_SIZE / 2);
      // Insert subChunks in place of the current chunk
      chunks.splice(i, 1, ...subChunks);
      i--;
      continue;
    }
    // If sending this chunk would exceed the limit, wait
    if (tokensUsedThisMinute + estimatedTokens > TOKENS_PER_MINUTE) {
      const elapsed = Date.now() - lastRequestTime;
      const waitTime = MS_PER_MINUTE - elapsed;
      if (waitTime > 0) {
        await sleep(waitTime);
      }
      tokensUsedThisMinute = 0;
      lastRequestTime = Date.now();
    }
    tokensUsedThisMinute += estimatedTokens;
    const chunkPrompt = `The following is chunk ${i + 1} of ${chunks.length} of the content. Please review and generate a report for this chunk.\n\n${chunk}`;
    const result = await reportModel.invoke([
      {
        role: "system",
        content: GENERATE_REPORT_PROMPT,
      },
      {
        role: "user",
        content: chunkPrompt,
      },
    ]);
    chunkReports.push(parseGeneration(result.content as string));
  }

  // Aggregate the chunk reports into a final report
  let finalReport = chunkReports.join("\n\n");
  if (chunkReports.length > 1) {
    // If there are multiple chunk reports, summarize them into a final report
    const summaryPrompt = `The following are reports generated from different chunks of a larger document. Please synthesize them into a single, coherent report.\n\n${finalReport}`;
    const summaryResult = await reportModel.invoke([
      {
        role: "system",
        content: GENERATE_REPORT_PROMPT,
      },
      {
        role: "user",
        content: summaryPrompt,
      },
    ]);
    finalReport = parseGeneration(summaryResult.content as string);
  }

  return {
    report: finalReport,
  };
}
