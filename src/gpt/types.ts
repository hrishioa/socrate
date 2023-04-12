import { ChatCompletionRequestMessageRoleEnum } from "openai";

// Console parsing types
export type DebateArguments = {
  problem: string;
  outputJSONFile?: string;
  rounds?: number;
  temperature?: number;
  moderationInterval?: number;
  GPT4: boolean;
  dontPrintToConsole: boolean;
  allowSpeakingTwice: boolean;
  help?: boolean;
};

// GPT Types
export type Message = {
  role: ChatCompletionRequestMessageRoleEnum;
  content: string;
};
export type Messages = Message[];

export type StreamToken = {
  type: "token";
  token: string;
};

export type StreamResult = {
  type: "completeMessage";
  completeMessage: string;
};

export type StreamStatistic =
  | {
      type: "promptTokenCount";
      tokenCount: number;
    }
  | {
      type: "responseTokenCount";
      tokenCount: number;
    };

export type GPTStatistics = {
  modelName: AcceptedModels;
  promptTokens: number;
  responseTokens: number;
};

export type GPTChainStatistics = (GPTStatistics & { callDesc: string })[];

export type RetryError =
  | "UNEXPECTED_END"
  | "RATE_LIMIT"
  | "ENGINE_OVERLOADED"
  | "OPENAI_SCREWUP";

export type UnrecoverableError =
  | "AUTH_ERROR"
  | "LAST_MESSAGE_TOO_LARGE"
  | "QUOTA_EXCEEDED"
  | "UNKNOWN"
  | "MANUAL_ABORT"
  | "TOKEN_LIMIT";

export type StreamError = {
  type: "error";
  errorType: RetryError | UnrecoverableError;
  partialMessage: string;
};

export type AcceptedModels = "gpt-3.5-turbo" | "gpt-4";

// Debate types
export type AgentLibrary = { [key: string]: Agent };

export type Agent = {
  name: string;
  bio: string;
  styleExample: string;
  gpt4Summary: string;
};

export type AgentThought = {
  agentName: string;
  speakNextProb: number;
  thoughts: string;
};

export type AgentResponse = {
  agentName: string;
  response: string;
};
