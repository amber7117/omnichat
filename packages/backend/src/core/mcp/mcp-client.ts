import { logger } from '../../utils/logger';

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface MCPCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class MCPClient {
  private tools: Map<string, (args: any) => Promise<MCPCallResult>> = new Map();

  constructor() {
    // Register default tools
    this.registerTool('weather', async (args: { location: string }) => {
      logger.info({ args }, 'MCP Tool Call: weather');
      return {
        content: [{ type: 'text', text: `The weather in ${args.location} is Sunny, 25°C.` }],
      };
    });

    this.registerTool('routes', async (args: { origin: string; destination: string }) => {
      logger.info({ args }, 'MCP Tool Call: routes');
      return {
        content: [{ type: 'text', text: `Route from ${args.origin} to ${args.destination}: 15 mins by car.` }],
      };
    });
  }

  registerTool(name: string, handler: (args: any) => Promise<MCPCallResult>) {
    this.tools.set(name, handler);
  }

  async listTools(): Promise<MCPTool[]> {
    // In a real implementation, this would fetch from an MCP server
    return [
      {
        name: 'weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City or location name' },
          },
          required: ['location'],
        },
      },
      {
        name: 'routes',
        description: 'Get route directions',
        parameters: {
          type: 'object',
          properties: {
            origin: { type: 'string' },
            destination: { type: 'string' },
          },
          required: ['origin', 'destination'],
        },
      },
    ];
  }

  async callTool(name: string, args: any): Promise<MCPCallResult> {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(`Tool ${name} not found`);
    }
    try {
      return await handler(args);
    } catch (err: any) {
      logger.error({ err, tool: name }, 'MCP Tool execution failed');
      return {
        content: [{ type: 'text', text: `Error executing tool: ${err.message}` }],
        isError: true,
      };
    }
  }
}

export const mcpClient = new MCPClient();
