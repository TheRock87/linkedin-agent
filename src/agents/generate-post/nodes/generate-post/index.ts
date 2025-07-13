// @ts-ignore
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatGroq } from "@langchain/groq";
import { GENERATE_POST_PROMPT } from "./prompts.js";
import { formatPrompt, parseGeneration } from "./utils.js";
import { ALLOWED_TIMES } from "../../constants.js";
import {
  getReflectionsPrompt,
  REFLECTIONS_PROMPT,
} from "../../../../utils/reflections.js";
import { getNextSaturdayDate } from "../../../../utils/date.js";

export async function generatePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.report) {
    throw new Error("No report found");
  }
  if (!state.relevantLinks?.length) {
    throw new Error("No relevant links found");
  }
  const postModel = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || (() => { throw new Error('GROQ_MODEL env variable is required'); })(),
    temperature: 0.5,
  });

  const prompt = formatPrompt(state.report, state.relevantLinks);

  const reflections = await getReflectionsPrompt(config);
  const reflectionsPrompt = REFLECTIONS_PROMPT.replace(
    "{reflections}",
    reflections,
  );

  const generatePostPrompt = GENERATE_POST_PROMPT.replace(
    "{reflectionsPrompt}",
    reflectionsPrompt,
  );

  // @ts-ignore
  const postResponse = await postModel.invoke([
    {
      role: "system",
      content: generatePostPrompt,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  // Randomly select a time from the allowed times
  const [postHour, postMinute] = ALLOWED_TIMES[
    Math.floor(Math.random() * ALLOWED_TIMES.length)
  ]
    .split(" ")[0]
    .split(":");
  const postDate = getNextSaturdayDate(Number(postHour), Number(postMinute));

  return {
    post: parseGeneration(postResponse.content as string),
    scheduleDate: postDate,
  };
}
