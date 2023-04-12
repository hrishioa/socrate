import * as dotenv from "dotenv";
dotenv.config();

import { isAxiosError } from "axios";
import { Configuration, OpenAIApi } from "openai";
import GPT3Tokenizer from "gpt3-tokenizer";
import fs from "fs";
import path from "path";
import {
  AcceptedModels,
  GPTChainStatistics,
  GPTStatistics,
  Messages,
  RetryError,
  StreamError,
  StreamResult,
  StreamStatistic,
  StreamToken,
  UnrecoverableError,
} from "./types";
const tokenizer = new GPT3Tokenizer({ type: "gpt3" });

if (!process.env.OPENAI_API_KEY) {
  console.log("PLEASE SET OPENAI_API_KEY IN THE .env FILE.");
  process.exit(1);
}

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const DEBUG = process.env.IS_DEBUG === "true";

export const modelProperties: {
  [key in AcceptedModels]: {
    readableName: string;
    // Total tokens accepted by the model
    tokenLimit: number;
    // How many tokens in the prompt leave too little room for the response?
    defaultPromptTokenRatio: number;
    // Cost per thousand tokens in USD for prompt and response
    costPerMille: {
      prompt: number;
      response: number;
    };
  };
} = {
  "gpt-3.5-turbo": {
    readableName: "GPT-3.5",
    tokenLimit: 4096,
    defaultPromptTokenRatio: 0.75,
    costPerMille: {
      prompt: 0.002,
      response: 0.002,
    },
  },
  "gpt-4": {
    readableName: "GPT-4.0",
    tokenLimit: 8192,
    defaultPromptTokenRatio: 0.8,
    costPerMille: {
      prompt: 0.03,
      response: 0.06,
    },
  },
};

/**
 * Trims a set of GPT Messages to fit a token size
 * @param messages Input GPT Messages
 * @param maxTokens Number of tokens to trim the messages down to.
 * @param keepSystemMessage Whether to try and keep the latest system message in the trimmed list, at the cost of user/assistant messages. False by default.
 * @returns
 */

export function fitMessagesToTokenLimit(
  messages: Messages,
  maxTokens: number,
  keepSystemMessage: boolean
) {
  let messageCount = 1;

  while (
    getMessagesTokenCount(messages.slice(-messageCount)) < maxTokens &&
    messageCount <= messages.length
  ) {
    messageCount++;
  }

  messageCount--;

  const messagesSlice = messageCount ? messages.slice(-messageCount) : [];

  if (
    keepSystemMessage &&
    !messagesSlice.some((message) => message.role === "system")
  ) {
    // there are no system messages present, now we've got to find one and add it while staying in the token limit
    const lastSystemMessage = messages
      .filter((message) => message.role === "system")
      .slice(-1);

    const lastSystemMessageTokenCount =
      getMessagesTokenCount(lastSystemMessage);

    if (lastSystemMessage.length && lastSystemMessageTokenCount < maxTokens) {
      // ok we found at least one that can fit in.

      let newMessageCount = 1;

      while (
        getMessagesTokenCount(messagesSlice.slice(-newMessageCount)) <
          maxTokens - lastSystemMessageTokenCount &&
        newMessageCount <= messagesSlice.length
      )
        newMessageCount++;

      newMessageCount--;

      const newMessagesSlice = newMessageCount
        ? messagesSlice.slice(-newMessageCount)
        : [];
      const newMessagesSliceTokenCount =
        getMessagesTokenCount(newMessagesSlice);

      if (
        newMessagesSliceTokenCount + lastSystemMessageTokenCount <
        maxTokens
      ) {
        return [...lastSystemMessage, ...newMessagesSlice];
      } else {
        return messagesSlice;
      }
    }
  }

  return messagesSlice;
}

export function stringifyChainStatistics(
  stats: GPTChainStatistics,
  groupByCallDesc: boolean = false,
  divideByCount?: number
): string {
  const boxWidth = 140;

  function equalizeLengthAndFormat(str) {
    return "# " + str + " ".repeat(boxWidth - str.length) + " #";
  }

  function getLine() {
    return "#".repeat(boxWidth + 4);
  }

  const costs: { promptCost: number; responseCost: number }[] = [];

  if (groupByCallDesc)
    stats = stats.reduce((acc, stat) => {
      const existingStat = acc.find(
        (accStat) => accStat.callDesc === stat.callDesc
      );
      if (existingStat) {
        existingStat.promptTokens += stat.promptTokens;
        existingStat.responseTokens += stat.responseTokens;
      } else {
        acc.push(stat);
      }
      return acc;
    }, [] as GPTChainStatistics);

  const perCallStatsStrs: string[] = stats.map((stat) => {
    const promptCost =
      (stat.promptTokens *
        modelProperties[stat.modelName].costPerMille.prompt) /
      1000;
    const responseCost =
      (stat.responseTokens *
        modelProperties[stat.modelName].costPerMille.response) /
      1000;

    costs.push({ promptCost, responseCost });

    return equalizeLengthAndFormat(
      `${modelProperties[stat.modelName].readableName} - Prompt: ${
        stat.promptTokens
      } ($${promptCost.toFixed(4)}) - Response: ${
        stat.responseTokens
      } ($${responseCost.toFixed(4)}) - Total: ${
        stat.responseTokens + stat.promptTokens
      } ($${(promptCost + responseCost).toFixed(4)}) run for ${stat.callDesc}`
    );
  });

  const perModelStatsStr = Object.keys(modelProperties)
    .map((modelName) => {
      const modelStats = stats.filter((stat) => stat.modelName === modelName);
      const promptTokens = modelStats.reduce(
        (acc, stat) => acc + stat.promptTokens,
        0
      );
      const responseTokens = modelStats.reduce(
        (acc, stat) => acc + stat.responseTokens,
        0
      );

      const promptCost =
        (promptTokens * modelProperties[modelName].costPerMille.prompt) / 1000;
      const responseCost =
        (responseTokens * modelProperties[modelName].costPerMille.response) /
        1000;

      return equalizeLengthAndFormat(
        `${
          modelProperties[modelName].readableName
        } total: Prompt : ${promptTokens} ($${promptCost.toFixed(
          4
        )}) - Response: ${responseTokens} ($${responseCost.toFixed(
          4
        )}) - Total: ${responseTokens + promptTokens} ($${(
          promptCost + responseCost
        ).toFixed(4)})`
      );
    })
    .join("\n");

  const totalCosts = costs.reduce(
    (acc, cost) => {
      acc.promptCost += cost.promptCost;
      acc.responseCost += cost.responseCost;
      return acc;
    },
    { promptCost: 0, responseCost: 0 }
  );

  const totalCostsStr = equalizeLengthAndFormat(
    `Total Prompt Cost: $${totalCosts.promptCost.toFixed(
      4
    )} - Total Response Cost: $${totalCosts.responseCost.toFixed(
      4
    )} - Total Cost: $${(
      totalCosts.promptCost + totalCosts.responseCost
    ).toFixed(4)} ${
      divideByCount
        ? `($${(
            (totalCosts.promptCost + totalCosts.responseCost) /
            divideByCount
          ).toFixed(4)} per item)`
        : ""
    }`
  );

  return `${getLine()}\n${perCallStatsStrs.join(
    "\n"
  )}\n${getLine()}\n${perModelStatsStr}\n${getLine()}\n${totalCostsStr}\n${getLine()}`;
}

function getTextFromMessages(messages: Messages) {
  return messages.map((message) => message.content).join("\n");
}

export function getMessagesTokenCount(messages: Messages) {
  const encoded = tokenizer.encode(getTextFromMessages(messages));
  return encoded.bpe.length;
}

/**
 * Function to return a promise instead of a stream when sending GPT messages, wraps streamChatGPT. Useful when the response doesn't go out to the user, so streaming isn't very useful.
 * @param messages Messages to pass GPT.
 * @param modelName Model to use, like gpt-3.5-turbo.
 * @param caseId caseId to use for logging, to connect GPT messages to originating conversation
 * @param abortSignal Use to stop streaming or responses in the middle. Useful for running multiple agents, to race them.
 * @param promptTokenRatio Each model has a maximum number of tokens. This ratio defines the maximum number of prompt tokens, to leave room for the response. Beyond this number, automated trimming is attempted to fit into the token limit.
 * @param temperature Affectes how deterministic/non-random the output is. OpenAI parameter.
 * @returns promise that resolves to a valid result from GPT or an error, and the statistics on number of tokens used for response and prompt.
 */
export async function askChatGPT(
  messages: Messages,
  modelName: AcceptedModels,
  caseId?: string,
  abortSignal?: AbortSignal,
  promptTokenRatio?: number,
  temperature?: number
): Promise<{
  response: StreamResult | StreamError;
  statistics: GPTStatistics;
}> {
  const streamedRes = streamChatGPT(
    messages,
    modelName,
    caseId,
    abortSignal,
    promptTokenRatio,
    false,
    temperature
  );

  const gptStats: GPTStatistics = {
    modelName,
    promptTokens: 0,
    responseTokens: 0,
  };

  try {
    for await (const response of streamedRes) {
      if (response.type === "promptTokenCount")
        gptStats.promptTokens = response.tokenCount;
      else if (response.type === "responseTokenCount")
        gptStats.responseTokens = response.tokenCount;

      if (response.type === "error" || response.type === "completeMessage")
        return {
          response,
          statistics: gptStats,
        };
    }
  } catch (err) {
    console.error("Error processing stream response from chatgpt - ", err);
  }

  return {
    response: {
      type: "error",
      errorType: "UNKNOWN",
      partialMessage: "",
    },
    statistics: gptStats,
  };
}

/**
 * Stream GPT responses as tokens, for performance and responsiveness. Returns statistics, GPT tokens, errors and other values as StreamX types.
 * @param messages Messages to pass GPT.
 * @param modelName Model to use, like gpt-3.5-turbo.
 * @param caseId caseId to use for logging, to connect GPT messages to originating conversation
 * @param abortSignal Use to stop streaming or responses in the middle. Useful for running multiple agents, to race them.
 * @param promptTokenRatio Each model has a maximum number of tokens. This ratio defines the maximum number of prompt tokens, to leave room for the response. Beyond this number, automated trimming is attempted to fit into the token limit.
 * @param dontTrimPromptToTokenRatio If set to false, this stops any trimming and just returns a failure. Designed for upstream callers that want to do task-specific message trimming on their own.
 * @param temperature Affectes how deterministic/non-random the output is. OpenAI parameter.
 * @returns
 */
export async function* streamChatGPT(
  messages: Messages,
  modelName: AcceptedModels,
  caseId?: string,
  abortSignal?: AbortSignal,
  promptTokenRatio?: number,
  dontTrimPromptToTokenRatio?: boolean, // Doing this because we don't want to break upstream calls by changing parameter order
  temperature?: number
): AsyncGenerator<
  StreamToken | StreamResult | StreamError | StreamStatistic,
  void,
  undefined
> {
  let completeMessage: string = "";

  const TOKEN_MARGIN: number = 100; // Margin so if our token calc doesn't match openais the API doesn't freak out.

  try {
    let tokenCount = getMessagesTokenCount(messages);

    let responseTokenCount = Math.floor(
      modelProperties[modelName].tokenLimit - tokenCount - TOKEN_MARGIN
    );

    if (!promptTokenRatio)
      promptTokenRatio = modelProperties[modelName].defaultPromptTokenRatio;

    let promptRatioTokensExceeded =
      promptTokenRatio * modelProperties[modelName].tokenLimit < tokenCount;

    if (DEBUG) {
      console.log(
        `Calling ${modelName}: Messages weigh about ${tokenCount} tokens, limit is ${
          modelProperties[modelName].tokenLimit
        }. Response tokens - ${responseTokenCount}, allowed prompt tokens - ${
          promptTokenRatio * modelProperties[modelName].tokenLimit
        }, exceeded? ${promptRatioTokensExceeded ? "Yes" : "No"}`
      );
    }

    if (promptRatioTokensExceeded) {
      if (!dontTrimPromptToTokenRatio) {
        // console.log(
        //   'Trimming messages to fit token limit, old size is ',
        //   tokenCount
        // );
        messages = fitMessagesToTokenLimit(
          messages,
          Math.floor(promptTokenRatio * modelProperties[modelName].tokenLimit),
          true
        );
        tokenCount = getMessagesTokenCount(messages);

        responseTokenCount = Math.floor(
          modelProperties[modelName].tokenLimit - tokenCount - TOKEN_MARGIN
        );

        promptRatioTokensExceeded =
          tokenCount > promptTokenRatio * modelProperties[modelName].tokenLimit;

        if (DEBUG)
          console.log(
            `Second try Calling ${modelName}: Messages weigh about ${tokenCount} tokens, limit is ${
              modelProperties[modelName].tokenLimit
            }. Response tokens - ${responseTokenCount}, allowed prompt tokens - ${
              promptTokenRatio * modelProperties[modelName].tokenLimit
            }, exceeded? ${promptRatioTokensExceeded ? "Yes" : "No"}`
          );
      }

      if (promptRatioTokensExceeded) {
        yield { type: "error", errorType: "TOKEN_LIMIT", partialMessage: "" };
        return;
      } else if (!messages.length) {
        yield {
          type: "error",
          errorType: "LAST_MESSAGE_TOO_LARGE",
          partialMessage: "",
        };
        return;
      }
    }

    // TODO: Implement rate limiting on requests and token counts here

    if (
      process.env.DATA_DIRECTORY &&
      process.env.GPT_LOG &&
      fs.existsSync(path.join(process.env.DATA_DIRECTORY, process.env.GPT_LOG))
    ) {
      fs.appendFileSync(
        path.join(process.env.DATA_DIRECTORY, process.env.GPT_LOG),
        JSON.stringify(
          { caseId, type: "Messages Sent", messages, modelName, tokenCount },
          null,
          2
        ) + "\n"
      );
    }
    const response = await openai.createChatCompletion(
      {
        model: modelName,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        temperature: temperature || 0,
        top_p: 1,
        max_tokens: responseTokenCount,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true,
      },
      {
        responseType: "stream",
        signal: abortSignal,
      }
    );

    yield {
      type: "promptTokenCount",
      tokenCount,
    };

    const dataStream = response.data as unknown as AsyncIterable<Buffer>;

    let doneReceived: boolean = false;

    for await (const chunk of dataStream) {
      if (doneReceived) break;

      if (abortSignal && abortSignal.aborted) {
        yield {
          type: "error",
          errorType: "MANUAL_ABORT",
          partialMessage: completeMessage,
        };
        break;
      }

      const lines = chunk
        .toString("utf8")
        .split("\n")
        .filter((line) => line.trim().startsWith("data: "));

      for (const line of lines) {
        const message = line.replace(/^data: /, "");
        if (message === "[DONE]") {
          doneReceived = true;
          break;
        }

        const json = JSON.parse(message);
        const token = json.choices[0].delta.content;

        if (token) {
          completeMessage += token;
          yield { type: "token", token };
        }
      }
    }

    if (doneReceived) {
      if (
        process.env.DATA_DIRECTORY &&
        process.env.GPT_LOG &&
        fs.existsSync(
          path.join(process.env.DATA_DIRECTORY, process.env.GPT_LOG)
        )
      ) {
        fs.appendFileSync(
          path.join(process.env.DATA_DIRECTORY, process.env.GPT_LOG),
          JSON.stringify(
            {
              caseId,
              type: "Successful Response",
              messages,
              response: completeMessage,
              modelName,
              tokenCount,
            },
            null,
            2
          ) + "\n"
        );
      }
      yield {
        type: "responseTokenCount",
        tokenCount: getMessagesTokenCount([
          { role: "assistant", content: completeMessage },
        ]),
      };
      yield { type: "completeMessage", completeMessage };
      return;
    } else {
      yield {
        type: "error",
        errorType: "UNEXPECTED_END",
        partialMessage: completeMessage,
      };
      return;
    }
  } catch (err) {
    // TODO: Turn this into proper logging
    console.error("Error processing for chatgpt, ", arguments, " - ", err);
    let errorType: RetryError | UnrecoverableError = "UNKNOWN";
    if (isAxiosError(err) && err.response) {
      if (err.response.status === 401) errorType = "AUTH_ERROR";
      else if (err.response.status === 429)
        // This is actually multiple errors, one of which is unrecoverable. From https://platform.openai.com/docs/guides/error-codes/api-errors I couldn't figure out how to tell.
        // TODO: 5 points to anyone who can! Please? Hendy? Albert?
        errorType = "RATE_LIMIT";
      else if (err.response.status === 500) errorType = "OPENAI_SCREWUP";
    }
    yield { type: "error", errorType, partialMessage: completeMessage };
  }
}
