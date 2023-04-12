# Socrate: Inform your decisions through AI agent debate

![Twitter Follow](https://img.shields.io/twitter/follow/hrishioa?style=social)

Socrate provides an automated discussion between different personalities simulated by GPT. Each agent has an internal monologue that is used to generate their response, and to decide who speaks next. Four premade agents are available (Plato, Richard Feynman, Trump and Elon Musk), but you can add your own!!

## 🔧 Usage

# PICTURE HERE

Run this to get started immediately (type this into your Terminal after [installing node](#installing-node),
```bash
npm i -g socrate
socrate -p 'Should California be its own country?'
```

Or clone the repo to customize agents and run:
```bash
git clone https://github.com/hrishioa/socrate
cd socrate
yarn
yarn start -p 'Why shouldnt California be a country?'
```

## Demo (11/04/2023):

# VIDEO DEMO HERE

## Options

You can run `socrate --help` to get this explanation of the customization:
```
Socrate

  A discussion room for using GPT personalities with internal monologues to
  debate problems. Provide a problem to start, or customize the settings of the
  debate room. Custom agents incoming!

Options

  -p, --problem string              The problem statement to debate, .e.g Should your creator have pizza for
                                    dinner?
  -o, --outputJSONFile string       The file to output the JSON of the debate to. Default is no output.
  --GPT4                            Use GPT-4 instead of GPT-3.5.
  -t, --temperature number          The temperature to use for the GPT model. Default is 0.5
  -r, --rounds number               The number of rounds to debate for. Default is 10.
  -d, --dontPrintToConsole          Don't print the debate to the console.
  -a, --allowSpeakingTwice          Allow agents to speak twice in a row.
  -m, --moderationInterval number   The number of rounds between moderator interjections. Default is 4, set to
                                    zero to disable the moderator's interjections.
  -h, --help                        Prints this usage guide
```

Here is an example using more configuration:
```bash
socrate --problem 'Why even ask questions?' --outputJSONFile '~/debate1output.json' --GPT4 --temperature 1.0 --rounds 20 --allowSpeakingTwice --moderationInterval 4
```

## 💇 Adding custom agents

Agents are located in `socrate/agents/premade_agents.json`. For now, you can edit this JSON to add your own agents. Custom generation of new agents with GPT is coming up, depending on where this project goes!

All you need, is
* A short bio of your person
* Some speaking examples (we only use the first 2000 characters)
* A small summary of their style (you can use ChatGPT to make this, I did)

## Installing Node

On Mac/Linux machines, you can install nvm using this in your terminal (use the [github link to nvm](https://github.com/nvm-sh/nvm) if you want to make sure you have the right file)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
```

Once that's done, restart your terminal and you can install node 19 with
```bash
nvm install 19
nvm alias default 19
```

That's it, now you are ready to [install socrate](#-usage)!
