#!/usr/bin/env node

/**
 * Entrypoint STDIO para o Servidor MCP
 * Usado para integração local com Claude Desktop, Cursor, e CLI Agents
 */

// Redireciona console.log para stderr no modo STDIO para não corromper o canal JSON-RPC (stdout)
console.log = (...args) => console.error(...args);

const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./server');

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[MCP-STDIO] Servidor MCP de Cotação de Planos de Saúde rodando via STDIO.');
}

main().catch((err) => {
  console.error('[MCP-STDIO] Erro fatal no servidor MCP:', err);
  process.exit(1);
});
