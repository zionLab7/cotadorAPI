/** Stateless Streamable HTTP transport; each request has independent MCP state. */
const express = require('express');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpServer } = require('./server');

function createHttpMcpRouter(authenticateMcp) {
  const router = express.Router();
  router.all('/', authenticateMcp, async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[MCP HTTP] Falha ao processar requisição:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Falha no MCP' });
    } finally {
      // Streaming GET stays open until the client disconnects; close only completed requests.
      if (res.writableEnded) await server.close();
      else res.once('close', () => void server.close());
    }
  });
  return router;
}

module.exports = { createHttpMcpRouter };
