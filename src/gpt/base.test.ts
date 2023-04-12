import { streamChatGPT } from "./base";
import { askChatGPT } from "./base";

async function runSimplePrompt() {
  const controller = new AbortController();

  const QUESTION = "Write me three paragraphs of Shakespeare.";

  const res = streamChatGPT(
    [
      {
        role: "system",
        content: QUESTION,
      },
    ],
    "gpt-3.5-turbo",
    "test",
    controller.signal
  );

  console.log("Asked ", QUESTION, "\n\n\n");

  process.stdout.write("Response: ");

  for await (const response of res) {
    if (response.type === "error") {
      console.error("\n\n\nError - ", response);
    } else if (response.type === "completeMessage") {
      console.log("\n\n\nGot complete message: " + response.completeMessage);
    } else {
      process.stdout.write(JSON.stringify(response));
    }
  }

  console.log("Asking instead of streaming...");

  const { response: res2 } = await askChatGPT(
    [
      {
        role: "system",
        content: QUESTION,
      },
    ],
    "gpt-3.5-turbo",
    "test",
    controller.signal
  );

  console.log("Got ", res2);
}

// Run this to see what happens
runSimplePrompt().then(() => console.log("\n\nDone."));
