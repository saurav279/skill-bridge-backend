import { env } from "../config/env";
import { AppError } from "../utils/errors";

type TextContentPart = {
  type: "text";
  text: string;
};

type FileContentPart = {
  type: "file";
  file: {
    filename: string;
    file_data: string;
  };
};

type UserContent = string | Array<TextContentPart | FileContentPart>;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: UserContent;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type ChatCompletionFile = {
  filename: string;
  mimeType: string;
  base64: string;
};

export async function chatCompletionJson(params: {
  system: string;
  user: string;
  file?: ChatCompletionFile;
}): Promise<unknown> {
  if (!env.openRouter.apiKey) {
    throw new AppError(
      "Missing OPENROUTER_API_KEY. Set it in .env to generate assessments.",
      500,
    );
  }

  const userContent: UserContent = params.file
    ? [
        {
          type: "file",
          file: {
            filename: params.file.filename,
            file_data: `data:${params.file.mimeType};base64,${params.file.base64}`,
          },
        },
        { type: "text", text: params.user },
      ]
    : params.user;

  const messages: ChatMessage[] = [
    { role: "system", content: params.system },
    { role: "user", content: userContent },
  ];


  let response: Response;
  try {
    response = await fetch(`${env.openRouter.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouter.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.openRouter.referer,
        "X-Title": env.openRouter.title,
      },
      body: JSON.stringify({
        model: env.openRouter.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      }),
    });
  } catch (error) {
    throw new AppError(
      `Failed to reach OpenRouter: ${error instanceof Error ? error.message : "unknown error"}`,
      500,
    );
  }

  const data = (await response.json()) as OpenRouterChatResponse;

  if (!response.ok) {
    throw new AppError(
      data.error?.message ?? `OpenRouter request failed (${response.status})`,
      500,
    );
  }
  //input and output tokens
  // console.log("input tokens", data.usage?.input_tokens);
  // console.log("output tokens", data.usage?.output_tokens);

  //gpt-5.6-luna: future model

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError("OpenRouter returned an empty response", 500);
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new AppError("OpenRouter returned invalid JSON", 500);
  }
}
