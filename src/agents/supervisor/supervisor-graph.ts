import { Annotation, END, Send, START, StateGraph } from "@langchain/langgraph";
import {
  SupervisorAnnotation,
  SupervisorConfigurableAnnotation,
  SupervisorState,
} from "./supervisor-state.js";
import { curateDataGraph } from "../curate-data/index.js";
import { convertPostToString } from "../verify-reddit-post/utils.js";
import { generateReportGraph } from "../generate-report/index.js";
import { groupReports } from "./nodes/group-reports.js";
import { determinePostType } from "./nodes/determine-post-type.js";
import { generatePosts } from "./nodes/generate-posts.js";

function startGenerateReportRuns(state: SupervisorState): Send[] {
  const {
    tweetsGroupedByContent,
    githubTrendingData,
    generalContents,
    redditPosts,
  } = state.curatedData;
  const tweetSends =
    tweetsGroupedByContent?.map((tweetGroup) => {
      return new Send("generateReport", {
        tweetGroup,
      });
    }) || [];
  const githubSends =
    githubTrendingData?.map((ghTrendingItem) => {
      return new Send("generateReport", {
        pageContent: [ghTrendingItem.pageContent],
        relevantLinks: [ghTrendingItem.repoURL],
      });
    }) || [];
  const generalSends =
    generalContents?.map((gc) => {
      return new Send("generateReport", {
        pageContent: [gc.pageContent],
        relevantLinks: gc.relevantLinks,
      });
    }) || [];
  const redditSends =
    redditPosts?.map((rp) => {
      return new Send("generateReport", {
        pageContent: [convertPostToString(rp)],
        relevantLinks: [rp.post.url],
      });
    }) || [];

  return [...tweetSends, ...githubSends, ...generalSends, ...redditSends];
}

const supervisorWorkflow = new StateGraph(
  { stateSchema: SupervisorAnnotation, input: Annotation.Root({}) },
  SupervisorConfigurableAnnotation,
)
  // Calls the curate-data agent to fetch data from different sources.
  // This also means grouping the data into related groups, and expanding
  // the external URLs found in the tweets.
  .addNode("ingestData", curateDataGraph)
  .addNode("generateReport", generateReportGraph)
  .addNode("groupReports", groupReports)
  .addNode("determinePostType", determinePostType)
  .addNode("generatePosts", generatePosts as any)

  .addEdge(START, "ingestData")
  .addConditionalEdges("ingestData", startGenerateReportRuns, [
    "generateReport",
  ])
  .addEdge("generateReport", "groupReports")
  .addEdge("groupReports", "determinePostType")
  .addEdge("determinePostType", "generatePosts")
  .addEdge("generatePosts", END);

export const supervisorGraph = supervisorWorkflow.compile();
supervisorGraph.name = "Supervisor Graph";
