import {
  BUSINESS_CONTEXT as LANGCHAIN_BUSINESS_CONTEXT,
  TWEET_EXAMPLES as LANGCHAIN_TWEET_EXAMPLES,
  POST_STRUCTURE_INSTRUCTIONS as LANGCHAIN_POST_STRUCTURE_INSTRUCTIONS,
  POST_CONTENT_RULES as LANGCHAIN_POST_CONTENT_RULES,
  CONTENT_VALIDATION_PROMPT as LANGCHAIN_CONTENT_VALIDATION_PROMPT,
} from "./prompts.langchain.js";
import { EXAMPLES } from "./examples.js";
import { useLangChainPrompts } from "../../utils.js";

export const TWEET_EXAMPLES = EXAMPLES.map(
  (example, index) => `<example index="${index}">\n${example}\n</example>`,
).join("\n");

/**
 * This prompt details the structure the post should follow.
 * Updating this will change the sections and structure of the post.
 * If you want to make changes to how the post is structured, you
 * should update this prompt, along with the `EXAMPLES` list.
 */
// Generates LinkedIn posts reflecting educational and personal growth in ML/DL/NLP/CV/LLMs
export const POST_STRUCTURE_INSTRUCTIONS = `<section key="1">
Start with an engaging hook or intriguing reflection about your learning experience, challenges, or recent achievement. Keep it brief, around 5-10 words, and optionally add an emoji to boost visibility.
</section>

<section key="2">
Share a concise narrative about your learning journey or recent project in Machine Learning, Deep Learning, NLP, Computer Vision, or Large Language Models. 
Highlight key skills developed, important milestones reached, or personal insights gained. Maintain a professional yet slightly informal and reflective tone.
Optionally use bullet points if mentioning specific courses or technical insights. Aim for clarity and authenticity.
</section>

<section key="3">
Conclude with a personal call-to-action encouraging engagement, like "Check out my project!" or "I'd love your thoughts!", optionally including an emoji. Keep this section short and engaging (3-6 words).
</section>`;

/**
 * This prompt is used when generating, condensing, and re-writing posts.
 * You should make this prompt very specific to the type of content you
 * want included/focused on in the posts.
 */
// Sets rules to generate clear, engaging, and human-like posts about personal ML/NLP learning journeys
export const POST_CONTENT_RULES = `
- Posts must center on your personal or academic journey in Machine Learning, Deep Learning, NLP, Computer Vision, or Large Language Models.
- Keep a natural, human-written tone—professional but conversational, reflective, and authentic.
- Include insights, lessons learned, or reflections to add depth.
- Use emojis sparingly to maintain engagement without being overwhelming.
- Always include relevant hashtags like #ML, #AI, #DeepLearning, #ComputerVision, #NLP, #LLMs, #LearningJourney.
- Maintain clarity, readability, and good formatting—use line breaks and optional bold/italic for emphasis.
- ALWAYS include a clear call to action if appropriate, inviting your audience to engage or explore further.`;

/**
 * This should contain "business content" into the type of content you care
 * about, and want to post/focus your posts on. This prompt is used widely
 * throughout the agent in steps such as content validation, and post generation.
 * It should be generalized to the type of content you care about, or if using
 * for a business, it should contain details about your products/offerings/business.
 */
export const BUSINESS_CONTEXT = `
Here is some context about the types of content you should be interested in prompting:
<business-context>
Your goal is generating LinkedIn posts that reflect your personal growth, learning experiences, projects, and accomplishments specifically in Machine Learning, Deep Learning, Natural Language Processing, Computer Vision, and Large Language Models. The posts should be educational, professional, personal, reflective, and engaging to an audience interested in tech and professional growth.
</business-context>`;

/**
 * A prompt to be used in conjunction with the business context prompt when
 * validating content for social media posts. This prompt should outline the
 * rules for what content should be approved/rejected.
 */
export const CONTENT_VALIDATION_PROMPT = `This content will be used to generate engaging, informative and educational social media posts.
The following are rules to follow when determining whether or not to approve content as valid, or not:
<validation-rules>
- The content may be about a new project, tool, service, or similar.
- The content is a blog post, or similar content of which, the topic is AI, which can likely be used to generate a high quality social media post.
- The goal of the final social media post should be to educate your users, or to inform them about new content, projects, services, or findings about AI.
- You should NOT approve content from users who are requesting help, giving feedback, or otherwise not clearly about software for AI.
- You only want to approve content which can be used as marketing material, or other content to promote the content above.
</validation-rules>`;

export function getPrompts() {
  // NOTE: you should likely not have this set, unless you want to use the LangChain prompts
  if (useLangChainPrompts()) {
    return {
      businessContext: LANGCHAIN_BUSINESS_CONTEXT,
      tweetExamples: LANGCHAIN_TWEET_EXAMPLES,
      postStructureInstructions: LANGCHAIN_POST_STRUCTURE_INSTRUCTIONS,
      postContentRules: LANGCHAIN_POST_CONTENT_RULES,
      contentValidationPrompt: LANGCHAIN_CONTENT_VALIDATION_PROMPT,
    };
  }

  return {
    businessContext: BUSINESS_CONTEXT,
    tweetExamples: TWEET_EXAMPLES,
    postStructureInstructions: POST_STRUCTURE_INSTRUCTIONS,
    postContentRules: POST_CONTENT_RULES,
    contentValidationPrompt: CONTENT_VALIDATION_PROMPT,
  };
}
