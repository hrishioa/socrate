#!/usr/bin/env node

import * as dotenv from "dotenv";
dotenv.config();

import { parse } from "ts-command-line-args";
import { DebateArguments } from './gpt/types';
import { debate } from './rundebate';
import { checkForStartingValuesAndSave } from './startingvalues';

checkForStartingValuesAndSave().then(() => {
  const args = parse<DebateArguments>(
    {
      problem: {
        type: String,
        alias: "p",
        description:
          "The problem statement to debate, .e.g Should your creator have pizza for dinner?",
      },
      outputJSONFile: {
        optional: true,
        type: String,
        alias: "o",
        description:
          "The file to output the JSON of the debate to. Default is no output.",
      },
      GPT4: {
        type: Boolean,
        description: "Use GPT-4 instead of GPT-3.5.",
      },
      temperature: {
        optional: true,
        type: Number,
        alias: "t",
        description: "The temperature to use for the GPT model. Default is 0.5",
      },
      rounds: {
        optional: true,
        type: Number,
        alias: "r",
        description: "The number of rounds to debate for. Default is 10.",
      },
      dontPrintToConsole: {
        type: Boolean,
        alias: "d",
        description: "Don't print the debate to the console.",
      },
      allowSpeakingTwice: {
        type: Boolean,
        alias: "a",
        description: "Allow agents to speak twice in a row.",
      },
      moderationInterval: {
        optional: true,
        type: Number,
        alias: "m",
        description: "The number of rounds between moderator interjections. Default is 4, set to zero to disable the moderator's interjections.",
      },
      help: {
        type: Boolean,
        optional: true,
        alias: "h",
        description: "Prints this usage guide",
      },
    },
    {
      helpArg: "help",
      headerContentSections: [
        {
          header: "Socrate",
          content: "A discussion room for using GPT personalities with internal monologues to debate problems. Provide a problem to start, or customize the settings of the debate room. Custom agents incoming!",
        },
      ],
      footerContentSections: [
        { header: "Footer", content: `Built on a Tuesday night by Hrishi (https://olickel.com)` },
      ],
    }
  );

  const defaults: Required<DebateArguments> = {
    problem: "Should your creator have pizza for dinner?",
    outputJSONFile: 'output.json',
    rounds: 10,
    temperature: 0.5,
    moderationInterval: 4,
    GPT4: false,
    dontPrintToConsole: false,
    allowSpeakingTwice: false,
    help: false,
  };

  (async function runDebateWithArgs() {
    await debate(args.outputJSONFile, args.problem, args.rounds || defaults.rounds, args.temperature || defaults.temperature, args.GPT4 ? 'gpt-4' : 'gpt-3.5-turbo', !args.dontPrintToConsole, !args.allowSpeakingTwice, args.moderationInterval || defaults.moderationInterval)
  })().then(() => console.log('Debate complete! Check the output file.'));
})