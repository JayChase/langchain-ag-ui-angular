import { AIMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';
import { graph, routeModelOutput, tools } from './agent.js';

describe('agent graph', () => {
  it('exports a compiled graph', () => {
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });

  it('exposes the haiku tool', () => {
    expect(tools.map((t) => t.name)).toEqual(['generate_haiku']);
  });

  it('generate_haiku accepts haiku lines and returns confirmation', async () => {
    const haiku = tools.find((t) => t.name === 'generate_haiku');

    const result = await haiku!.invoke({
      japanese: '古池や',
      english: 'Still water holds the sky.',
      sumiE: '<svg><circle cx="10" cy="10" r="5" fill="#231300"/></svg>',
    });

    expect(result).toBe('Haiku displayed.');
  });

  it('routes to tools when the last message has tool calls', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'call_1',
          name: 'generate_haiku',
          args: {},
        },
      ],
    });

    expect(routeModelOutput({ messages: [message] })).toBe('tools');
  });

  it('routes to __end__ when there are no tool calls', () => {
    expect(
      routeModelOutput({ messages: [new AIMessage({ content: 'done' })] }),
    ).toBe('__end__');
  });
});
