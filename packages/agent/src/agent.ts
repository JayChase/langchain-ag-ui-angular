import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from '@azure/identity';
import type { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';

import { MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HaikuResultSchema } from 'schemas';
import { EnvSchema } from './models/settings.js';

const settings = EnvSchema.parse(process.env);

const credential = new DefaultAzureCredential();

const tokenProvider = getBearerTokenProvider(
  credential,
  'https://cognitiveservices.azure.com/.default',
);

const azureAdFetch: typeof fetch = async (url, init) => {
  const token = await tokenProvider();
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
};

const generateHaikuTool = tool(async () => 'Haiku displayed.', {
  name: 'generate_haiku',
  description:
    'Display a haiku to the user with Japanese characters and English translation. Also display the sumi-e style svg image representing the haiku theme. The svg should be transparent with #231300 as the color for stroke and fill Keep the SVG under 300 tokens.',
  schema: HaikuResultSchema,
});

export const tools = [generateHaikuTool];

// Define the function that calls the model
async function callModel(state: typeof MessagesAnnotation.State) {
  /**
   * Call the LLM powering our agent.
   * Feel free to customize the prompt, model, and other logic!
   */
  const model = new ChatOpenAI({
    model: settings.chatModelName,
    temperature: settings.temperature ?? 0.7,
    maxTokens: settings.maxTokens ?? 1024,
    apiKey: 'azure-ad',
    configuration: {
      baseURL: settings.azureAIEndpoint,
      ...(settings.azureAIApiVersion && {
        defaultQuery: { 'api-version': settings.azureAIApiVersion },
      }),
      fetch: azureAdFetch,
    },
  });

  const modelWithTools = model.bindTools(tools);

  const response = await modelWithTools.invoke([
    {
      role: 'system',
      content: `You are a helpful assistant.When the user asks for a haiku also create a svg image to represent the haiku theme with a transparent background in the style of sumi-e  When a tool produces a visual or formatted result (such as a haiku or card), the user interface displays the card directly. Do NOT repeat, recite, or reformat the tool output in your response text. Provide only a brief friendly acknowledgment or no extra text.`,
    },
    ...state.messages,
  ]);

  // MessagesAnnotation supports returning a single message or array of messages
  return { messages: response };
}

// Define the function that determines whether to continue or not
export function routeModelOutput(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage | undefined;
  // If the LLM is invoking tools, route there.
  if ((lastMessage?.tool_calls?.length ?? 0) > 0) {
    return 'tools';
  }
  // Otherwise end the graph.
  return '__end__';
}

// Define a new graph.
// See https://langchain-ai.github.io/langgraphjs/how-tos/define-state/#getting-started for
// more on defining custom graph states.
const workflow = new StateGraph(MessagesAnnotation)
  // Define the two nodes we will cycle between
  .addNode('callModel', callModel)
  .addNode('tools', new ToolNode(tools))
  // Set the entrypoint as `callModel`
  // This means that this node is the first one called
  .addEdge('__start__', 'callModel')
  .addConditionalEdges(
    // First, we define the edges' source node. We use `callModel`.
    // This means these are the edges taken after the `callModel` node is called.
    'callModel',
    // Next, we pass in the function that will determine the sink node(s), which
    // will be called after the source node is called.
    routeModelOutput,
    // List of the possible destinations the conditional edge can route to.
    // Required for conditional edges to properly render the graph in Studio
    ['tools', '__end__'],
  )
  // This means that after `tools` is called, `callModel` node is called next.
  .addEdge('tools', 'callModel');

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
export const graph = workflow.compile();
