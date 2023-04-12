import { MODERATOR_COMMENTS, PREMADE_AGENTS, processResponse, processThoughts } from './debate';
import { AcceptedModels, Agent, AgentResponse, AgentThought } from './gpt/types';
import fs from 'fs';

export async function debate(outputJSONFile: string | undefined, problemStatement: string = 'Socrates: Smash or pass?', rounds: number = 10, temperature: number = 0.5, model: AcceptedModels = 'gpt-3.5-turbo', printToConsole: boolean = true, noSpeakingTwice: boolean = true, moderatorInterjectRounds: number = 4, agentIds: string[] = Object.keys(PREMADE_AGENTS), ) {
  const agents = agentIds.map((agentId) => PREMADE_AGENTS[agentId])

  // TODO: Add custom agents?

  const conversationMessages = [`Moderator: Let us begin by discussing the topic '${problemStatement}'. Welcome ${agents.map((agent) => agent.name).join(', ')}.`]

  console.log(`The problem is '${problemStatement}'. Welcome ${agents.map((agent) => agent.name).join(', ')} to the discussion.`);

  let currentSpeakerName = '';

  const allThoughts: AgentThought[][] = [];
  const responses: AgentResponse[] = [];

  for(let i=0;i<rounds;i++) {
    console.log('\n-----------------\nRound',i+1,'\n-----------------\n');

    const thoughts: AgentThought[] = [];

    if(moderatorInterjectRounds !== 0 && i > 0 && i % moderatorInterjectRounds === 0) {
      conversationMessages.push(`Moderator: ${MODERATOR_COMMENTS[Math.floor(Math.random()*MODERATOR_COMMENTS.length)]}`);
      console.log('Moderator interjects: ',conversationMessages[conversationMessages.length-1]);
    }

    // Let's think
    for(let j=0;j<agents.length;j++) {
      if(!noSpeakingTwice || agents[j].name !== currentSpeakerName)
        thoughts.push(await processThoughts(agents[j], problemStatement, conversationMessages, temperature, model, printToConsole));
    }

    allThoughts.push(thoughts);

    const speakingOrder = thoughts.filter(thought => thought.agentName !== currentSpeakerName).sort((a,b) => {
      if(a.speakNextProb === b.speakNextProb)
        return (Math.random()*2)-1
      return b.speakNextProb-a.speakNextProb
    });

    console.log('Moderator: Next speaking will be ',speakingOrder[0].agentName);

    const selectedAgent: Agent = agents.find(agent => agent.name === speakingOrder[0].agentName)!;
    currentSpeakerName = selectedAgent.name;

    const response = await processResponse(selectedAgent, conversationMessages, speakingOrder[0].thoughts, temperature, model, printToConsole);

    responses.push(response);

    conversationMessages.push(response.response);

    if(outputJSONFile)
      fs.writeFileSync(outputJSONFile, JSON.stringify({
        thoughts: allThoughts,
        responses
      }, null, 2));
  }
}