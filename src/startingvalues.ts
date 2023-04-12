import { createInterface } from 'readline';
import path from 'path';
import fs from 'fs';
import * as dotenv from "dotenv";
import { reconfigureGPT } from './gpt/base';
dotenv.config();

const ENV_FILE_LOCATION = path.join(__dirname, '..', '.env');
const DATA_DIR_LOCATION = path.join(__dirname, '..', 'data');

const question = (questionText: string) => {
  const rl = createInterface({
      input: process.stdin,
      output: process.stdout
  });

  return new Promise<string>(resolve => rl.question(questionText, resolve))
      .finally(() => rl.close());
}

export async function checkForStartingValuesAndSave() {
  if(!process.env.OPENAI_API_KEY) {
    console.log(`Please provide an OpenAI key. This will be saved to ${ENV_FILE_LOCATION} on your system (and never sent anywhere else) for future use. It will be deleted when you uninstall this package.`)

    const openAIKey = await question('OpenAI Key: ');

    if(fs.existsSync(ENV_FILE_LOCATION)) {
      fs.appendFileSync(ENV_FILE_LOCATION, `\nOPENAI_API_KEY=${openAIKey}`);
    } else {
      fs.writeFileSync(ENV_FILE_LOCATION, `OPENAI_API_KEY=${openAIKey}`);
    }

    process.env.OPENAI_API_KEY = openAIKey;

    reconfigureGPT();

    const saveGPTLog = await question(`Would you like to save gpt message logs to ${DATA_DIR_LOCATION}? (y/n): `);

    if(saveGPTLog.toLowerCase().includes('y')) {
      if(!fs.existsSync(DATA_DIR_LOCATION)) {
        fs.mkdirSync(DATA_DIR_LOCATION);
      }

      process.env.DATA_DIRECTORY = DATA_DIR_LOCATION;
      process.env.GPT_LOG = 'gpt.ndjson';


      if(fs.existsSync(ENV_FILE_LOCATION)) {
        fs.appendFileSync(ENV_FILE_LOCATION, `\nDATA_DIRECTORY=${DATA_DIR_LOCATION}\nGPT_LOG=gpt.ndjson`);
      } else {
        fs.writeFileSync(ENV_FILE_LOCATION, `DATA_DIRECTORY=${DATA_DIR_LOCATION}\nGPT_LOG=gpt.ndjson`);
      }

      fs.writeFileSync(path.join(DATA_DIR_LOCATION, 'gpt.ndjson'), '');

    }

    console.log('Thank you! This is a one time thing. You can edit the .env file if you would like to change the key later.');
  }
}