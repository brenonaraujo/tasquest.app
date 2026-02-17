import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const TASKQUEST_API_URL = process.env.TASKQUEST_API_URL || "http://localhost:3000";

async function proxyToApi(req: Request, res: Response) {
  const path = req.path.replace("/api/v1", "/v1");
  const queryString = req.originalUrl.includes("?")
    ? "?" + req.originalUrl.split("?").slice(1).join("?")
    : "";
  const url = `${TASKQUEST_API_URL}${path}${queryString}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (req.headers.authorization) {
    headers["Authorization"] = req.headers.authorization as string;
  }

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOptions);

    const contentType = response.headers.get("content-type");
    if (response.status === 204) {
      return res.status(204).send();
    }

    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (error) {
    console.error("Proxy error:", error);
    return res.status(502).json({
      error: { code: "PROXY_ERROR", message: "Failed to reach TaskQuest API" },
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/xp-suggest", async (req: Request, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title) {
        return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Title is required" } });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: [
          {
            role: "system",
            content: `You are a task XP reward evaluator for a gamified to-do app called TaskQuest. 
Evaluate the complexity, effort, and impact of a task and suggest an XP reward between 5 and 50.
Guidelines:
- 5-10 XP: Very simple tasks (e.g., "Take out trash", "Reply to email")
- 11-20 XP: Moderate tasks (e.g., "Clean the kitchen", "Write a report draft")
- 21-35 XP: Complex tasks (e.g., "Organize garage", "Prepare presentation")
- 36-50 XP: Very challenging tasks (e.g., "Deep clean entire house", "Complete project milestone")
Respond ONLY with valid JSON: { "suggestedXp": number, "justification": "brief reason" }`,
          },
          {
            role: "user",
            content: `Title: ${title}${description ? `\nDescription: ${description}` : ""}`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 200,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      const suggestedXp = Math.max(5, Math.min(50, result.suggestedXp || 10));
      return res.json({ suggestedXp, justification: result.justification || "" });
    } catch (error) {
      console.error("XP suggestion error:", error);
      return res.status(500).json({ error: { code: "AI_ERROR", message: "Failed to generate XP suggestion" } });
    }
  });

  app.all("/api/v1/{*path}", proxyToApi);

  const httpServer = createServer(app);
  return httpServer;
}
