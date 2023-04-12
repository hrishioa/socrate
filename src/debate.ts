import * as dotenv from "dotenv";
dotenv.config();

import {
  AcceptedModels,
  Agent,
  AgentLibrary,
  AgentResponse,
  AgentThought,
  Messages,
  StreamError,
  StreamToken,
} from "./gpt/types";
import fs from "fs";
import path from "path";

import { streamChatGPT } from "./gpt/base";

if (!process.env.DATA_DIRECTORY) {
  console.error("PLEASE SET DATA_DIRECTORY IN THE .env FILE.");
  process.exit(1);
}

// Main constants for this module
export const PREMADE_AGENTS = JSON.parse(
  fs.readFileSync(
    path.join(process.env.DATA_DIRECTORY, "premade_agents.json"),
    "utf8"
  )
) as AgentLibrary;

const BASEMODEL: AcceptedModels = "gpt-3.5-turbo";
const TEMPERATURE = 0.75;

export const MODERATOR_COMMENTS = [
  "Great point! How do you think that idea could be implemented in real life situations?",
  "Interesting perspective! Can anyone provide a counter-argument or an alternative solution?",
  "Let's dive deeper into this topic. What are some potential consequences or benefits of this approach?",
  "That's a thought-provoking statement. How might others feel about that opinion? Let's hear from more voices!",
  "Thank you for sharing,. Does anyone have a personal experience that relates to this discussion?",
  "Intriguing suggestion! Can anyone provide an example of this concept in action, or propose a way to test its effectiveness?",
  "I love the passion in this discussion! Let's keep the momentum going by exploring some potential long-term impacts of this idea.",
  "What an insightful comment! How might this idea be adapted to different contexts or industries?",
  "We have some fantastic ideas flowing here! Can anyone build upon what's been said or offer a new angle to consider?",
  "Thank you for your input, everyone! To challenge our thinking, let's play devil's advocate for a moment. Are there any potential drawbacks or obstacles to consider?",
];

// GPT Tokens to recognize and parse
const SPEAK_NEXT_PROB_TOKEN = "speakNextProb";
const getAgentSpeakingToken = (agent: Agent) => `${agent.name}:`;

// Get streaming thoughts.
async function* getThoughtsAsAgent(
  agent: Agent,
  userMessages: Messages,
  problemStatement: string,
  temperature: number,
  model: AcceptedModels
): AsyncGenerator<StreamToken | StreamError, void, undefined> {
  const AGENT_SPEAKING_TOKEN = `${agent.name}: `;

  // prettier-ignore
  const prompts = {
    startingMessage: `Moderator: Let us begin by discussing ${problemStatement}.`,
    responsePrompt:
`The conversation is about "${problemStatement}". What would be your private thoughts (as ${agent.name}) about what you want to say next? Private thoughts are not to be shared, but to build reasoning around your thoughts how to respond to the conversation. Provide your thoughts in ${agent.name}, condensed or bullet points is good, not more than one paragraph.

Would ${agent.name} prefer to be the next one speaking? At the end, provide a probability that you would prefer to speak next in the format "${SPEAK_NEXT_PROB_TOKEN}: <float between 0 and 1>"

  ${AGENT_SPEAKING_TOKEN}`,
    systemPrompt:
`You are ${agent.name}, and your biography is below. You are to engage in discussion with a moderator and some other personalities about a given problem.

Techniques for debate:
1. Try to respond to other agents and address their points.
2. Provide criticism, agreement or countercrticism where appropriate.
3. Suggest actions with appropriate strength.
4. Agree and arrive at joint plans as the conversation progresses.
5. Debate with vigor.

Bio:
\`\`\`
${agent.bio}
\`\`\`
`
  }

  if (!userMessages.length)
    userMessages = [
      {
        role: "user",
        content: prompts.startingMessage,
      },
    ];

  userMessages.forEach((message) => {
    if (
      message.content.toLowerCase().includes(AGENT_SPEAKING_TOKEN.toLowerCase())
    )
      message.role = "assistant";
    else message.role = "user";
  });

  const messages: Messages = [
    {
      role: "system",
      content: prompts.systemPrompt,
    },
    ...userMessages,
    {
      role: "user",
      content: prompts.responsePrompt,
    },
  ];

  const response = await streamChatGPT(
    messages,
    model,
    undefined,
    undefined,
    undefined,
    undefined,
    temperature
  );

  for await (const token of response) {
    if (token.type === "token" || token.type === "error") yield token;
  }
}

async function* getResponseAsAgent(
  agent: Agent,
  thoughts: string,
  userMessages: Messages,
  temperature: number,
  model: AcceptedModels
): AsyncGenerator<StreamToken | StreamError, void, undefined> {
  const AGENT_SPEAKING_TOKEN = getAgentSpeakingToken(agent);

  // prettier-ignore
  const prompts = {
    systemPrompt:
`You are ${agent.name}, and you are engaging in a discussion with some people about a given problem. Use the description of your Speaking Style, Excerpts and anything you know to sound as close to the way ${agent.name} speaks. Listen to the moderator.

Excerpts:
\`\`\`
${agent.styleExample.substring(0, 2000)}
\`\`\`

Speaking Style:
\`\`\`
${agent.gpt4Summary}
\`\`\``,
    responsePrompt:
`Your internal thoughts about this discussion are:
\`\`\`
${thoughts}
\`\`\`

Techniques:
1. Try to respond to other agents and address their points.
2. Provide criticism, agreement or countercrticism where appropriate.
3. Suggest actions with appropriate strength.
4. Agree and arrive at joint plans as the conversation progresses.
5. Debate with vigor.

Respond now, assertively, to the conversation as if you are ${agent.name}, and stop speaking when ${agent.name} is finished. Speak for one paragraph, but shorter is better. Don't repeat yourself. Try to take the conversation forward using the Techniques. Bias towards action.`
  }

  userMessages.forEach((message) => {
    if (
      message.content.toLowerCase().includes(AGENT_SPEAKING_TOKEN.toLowerCase())
    )
      message.role = "assistant";
    else message.role = "user";
  });

  userMessages.forEach((message) => {
    if (
      message.content.toLowerCase().includes(AGENT_SPEAKING_TOKEN.toLowerCase())
    )
      message.role = "assistant";
    else message.role = "user";
  });

  const messages: Messages = [
    {
      role: "system",
      content: prompts.systemPrompt,
    },
    ...userMessages,
    {
      role: "user",
      content: prompts.responsePrompt,
    },
  ];

  const response = await streamChatGPT(
    messages,
    model,
    undefined,
    undefined,
    undefined,
    undefined,
    temperature
  );

  yield {
    type: "token",
    token: AGENT_SPEAKING_TOKEN,
  };

  for await (const token of response) {
    if (token.type === "token" || token.type === "error") yield token;
  }
}

// Get streaming thoughts, print them and return the speakNextProb and thoughts.
export async function processThoughts(
  agent: Agent,
  problemStatement: string,
  conversationHistory: string[],
  temperature: number,
  model: AcceptedModels,
  printToConsole: boolean = true
): Promise<AgentThought> {
  const messages: Messages = conversationHistory.map((message) => ({
    role: "user",
    content: message,
  }));

  if (printToConsole) console.log(`${agent.name} thinks:`);

  const thoughtGenerator = await getThoughtsAsAgent(
    agent,
    messages,
    problemStatement,
    temperature,
    model
  );

  let resStr = "";
  for await (const message of thoughtGenerator) {
    if (message.type === "token") {
      if (printToConsole) process.stdout.write(message.token);
      resStr += message.token;
    } else if (message.type === "error") {
      console.error("Error: ", message);
    }
  }

  if (printToConsole) process.stdout.write("\n");

  const probTokenRegex = new RegExp(
    `${SPEAK_NEXT_PROB_TOKEN}:[\\s]*?(\\d(?:\\.\\d+)?)`,
    "i"
  );
  const match = resStr.match(probTokenRegex);

  if (!match) {
    return {
      speakNextProb: 0,
      agentName: agent.name,
      thoughts: resStr,
    };
  } else {
    return {
      speakNextProb: parseFloat(match[1]),
      agentName: agent.name,
      thoughts: resStr.slice(0, match.index).trim(),
    };
  }
}

// Get streaming response, print it and return the response.
export async function processResponse(
  agent: Agent,
  conversationHistory: string[],
  thoughts: string,
  temperature: number,
  model: AcceptedModels,
  printToConsole: boolean = true
): Promise<AgentResponse> {
  const messages: Messages = conversationHistory.map((message) => ({
    role: "user",
    content: message,
  }));

  if (printToConsole) console.log(`\n\n${agent.name} says:`);
  const responseGenerator = getResponseAsAgent(
    agent,
    thoughts,
    messages,
    temperature,
    model
  );

  let resStr = "";

  for await (const message of responseGenerator) {
    if (message.type === "token") {
      resStr += message.token;
      if (printToConsole) process.stdout.write(message.token);
    } else if (message.type === "error") {
      console.error("Error: ", message);
    }
  }

  if (printToConsole) process.stdout.write("\n\n");

  return {
    agentName: agent.name,
    response: resStr,
  };
}
