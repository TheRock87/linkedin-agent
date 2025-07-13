// Usage:
// 1. Create a config.json file in the same directory as this script:
//    {
//      "urls": ["https://example.com/1", "https://example.com/2"],
//      "mode": "single" // or "multiple"
//    }
// 2. Optionally, a used-urls.json file will be created/updated to avoid reposting the same URLs.
//
// This script will skip URLs that have already been used.

import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import {
  SKIP_CONTENT_RELEVANCY_CHECK,
  SKIP_USED_URLS_CHECK,
  TEXT_ONLY_MODE,
} from "../src/agents/generate-post/constants.js";
import fs from "fs";
import path from "path";
const CONFIG_PATH = path.join(process.cwd(), "config.json");

const USED_URLS_PATH = path.join(process.cwd(), "used-urls.json");

function ensureConfigTemplate() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ urls: ["https://example.com/1"], mode: "single" }, null, 2)
    );
    console.log("Created config.json template. Please edit it and re-run the script.");
    process.exit(0);
  }
}

function loadConfig() {
  ensureConfigTemplate();
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function loadUsedUrls() {
  if (!fs.existsSync(USED_URLS_PATH)) return [];
  return JSON.parse(fs.readFileSync(USED_URLS_PATH, "utf-8"));
}

function saveUsedUrls(urls: string[]) {
  fs.writeFileSync(USED_URLS_PATH, JSON.stringify(urls, null, 2));
}

async function invokeGraph() {
  const config = loadConfig();
  let urls: string[] = config.urls || [];
  const mode: "single" | "multiple" = config.mode || "multiple";

  // Remove already used URLs
  const usedUrls: string[] = loadUsedUrls();
  const newUrls = urls.filter((url) => !usedUrls.includes(url));
  if (newUrls.length === 0) {
    console.log("No new URLs to post. All URLs have already been used.");
    return;
  }

  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  if (mode === "single") {
    // One post for all URLs
    const { thread_id } = await client.threads.create();
    await client.runs.create(thread_id, "generate_post", {
      input: {
        links: newUrls,
      },
      config: {
        configurable: {
          [TEXT_ONLY_MODE]: false,
          [SKIP_CONTENT_RELEVANCY_CHECK]: true,
          [SKIP_USED_URLS_CHECK]: true,
        },
      },
    });
    console.log(`Created one post for all URLs:`, newUrls);
    saveUsedUrls([...usedUrls, ...newUrls]);
  } else {
    // One post per URL
    for (const link of newUrls) {
      const { thread_id } = await client.threads.create();
      await client.runs.create(thread_id, "generate_post", {
        input: {
          links: [link],
        },
        config: {
          configurable: {
            [TEXT_ONLY_MODE]: false,
            [SKIP_CONTENT_RELEVANCY_CHECK]: true,
            [SKIP_USED_URLS_CHECK]: true,
          },
        },
      });
      console.log(`Created post for URL:`, link);
      usedUrls.push(link);
      saveUsedUrls(usedUrls);
    }
  }
}

invokeGraph().catch(console.error);
