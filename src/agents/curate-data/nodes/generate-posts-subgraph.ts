// Usage:
// Reads URLs and mode from config.json at the project root:
//   {
//     "urls": ["https://example.com/1", "https://example.com/2"],
//     "mode": "single" // or "multiple"
//   }
// Tracks used URLs in used-urls.json at the project root.
//
// This logic is only used if the file is run directly (not as a module).

import { Client } from "@langchain/langgraph-sdk";
import { CurateDataState } from "../state.js";
import { getTweetLink } from "../../../clients/twitter/utils.js";
import { POST_TO_LINKEDIN_ORGANIZATION } from "../../generate-post/constants.js";
import {
  getAfterSecondsFromLinks,
  shouldPostToLinkedInOrg,
} from "../../utils.js";
import { BaseStore, LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  getGitHubRepoURLs,
  putGitHubRepoURLs,
} from "../utils/stores/github-repos.js";
import {
  getRedditPostIds,
  putRedditPostIds,
} from "../utils/stores/reddit-post-ids.js";
import { getTweetIds, putTweetIds } from "../utils/stores/twitter.js";
import { SlackClient } from "../../../clients/slack/client.js";
import { ThreadRunId } from "../types.js";

async function saveIngestedData(
  state: CurateDataState,
  store: BaseStore | undefined,
) {
  const [existingGitHubRepoURLs, redditPostIds, existingTweetIds] =
    await Promise.all([
      getGitHubRepoURLs(store),
      getRedditPostIds(store),
      getTweetIds(store),
    ]);

  const newGitHubRepoURLs = new Set([
    ...existingGitHubRepoURLs,
    ...state.rawTrendingRepos,
  ]);
  const newRedditPostIds = new Set([
    ...redditPostIds,
    ...state.rawRedditPosts.map((p) => p.post.id),
  ]);
  const newTweetIds = new Set([
    ...existingTweetIds,
    ...state.rawTweets.map((t) => t.id),
  ]);

  await Promise.all([
    putGitHubRepoURLs(Array.from(newGitHubRepoURLs), store),
    putRedditPostIds(Array.from(newRedditPostIds), store),
    putTweetIds(Array.from(newTweetIds), store),
  ]);
}

async function sendSlackNotification(
  state: CurateDataState,
  config: LangGraphRunnableConfig,
) {
  if (!process.env.SLACK_CHANNEL_ID || !process.env.SLACK_TOKEN) {
    return;
  }

  const slackClient = new SlackClient({
    token: process.env.SLACK_TOKEN,
  });

  try {
    await saveIngestedData(state, config.store);
    if (slackClient) {
      await slackClient.sendMessage(
        process.env.SLACK_CHANNEL_ID,
        `✅ INGESTED DATA SAVED SUCCESSFULLY ✅

Number of tweets: *${state.rawTweets.length}*
Number of repos: *${state.rawTrendingRepos.length}*
Number of reddit posts: *${state.rawRedditPosts.length}*
Run ID: *${config.configurable?.run_id || "not found"}*
Thread ID: *${config.configurable?.thread_id || "not found"}*
      `,
      );
    }
  } catch (error: any) {
    console.warn("Error saving ingested data", error);
    if (slackClient) {
      const errMessage = "message" in error ? error.message : String(error);

      await slackClient.sendMessage(
        process.env.SLACK_CHANNEL_ID,
        `FAILED TO SAVE INGESTED DATA: ${errMessage}
  
Run ID: *${config.configurable?.run_id || "not found"}*
Thread ID: *${config.configurable?.thread_id || "not found"}*
      `,
      );
    }
  }
}

function getAfterSeconds(state: CurateDataState) {
  const twitterURLs = state.rawTweets.flatMap((t) =>
    t.author_id ? [getTweetLink(t.author_id, t.id)] : [],
  );
  const redditURLs = state.rawRedditPosts.map((p) => p.post.url);
  const afterSecondsList = getAfterSecondsFromLinks(
    [...twitterURLs, ...redditURLs, ...state.rawTrendingRepos],
    {
      baseDelaySeconds: 60,
    },
  );

  return afterSecondsList;
}

export async function generatePostsSubgraph(
  state: CurateDataState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CurateDataState>> {
  /**
   * Supports two modes:
   * - mode: 'single'   => one post for all links
   * - mode: 'multiple' => one post per link (default)
   * Set mode in config.configurable.mode
   */
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);
  const mode = config.configurable?.mode || "multiple";

  const client = new Client({
    apiUrl: `http://localhost:${process.env.PORT}`,
  });

  const afterSecondsList = getAfterSeconds(state);
  const threadRunIds: ThreadRunId[] = [];

  if (mode === "single") {
    // One post for all links
    const allLinks = afterSecondsList.map(({ link }) => link);
    const { thread_id } = await client.threads.create();
    const { run_id } = await client.runs.create(thread_id, "generate_post", {
      input: {
        links: allLinks,
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
          origin: "curate-data",
        },
      },
      // Use the first afterSeconds for scheduling, or 0 if none
      afterSeconds: afterSecondsList[0]?.afterSeconds || 0,
    });
    threadRunIds.push({ thread_id, run_id });
  } else {
    // One post per link (default)
    for (const { link, afterSeconds } of afterSecondsList) {
      const { thread_id } = await client.threads.create();
      const { run_id } = await client.runs.create(thread_id, "generate_post", {
        input: {
          links: [link],
        },
        config: {
          configurable: {
            [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
            origin: "curate-data",
          },
        },
        afterSeconds,
      });
      threadRunIds.push({ thread_id, run_id });
    }
  }

  await sendSlackNotification(state, config);

  return {
    threadRunIds,
  };
}
