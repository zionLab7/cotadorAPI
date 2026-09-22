/**
 * Transporte SSE (Server-Sent Events) para o Servidor MCP
 * Permite que Agentes de IA remotos (Cursor, N8N, LangChain, etc.) conectem via HTTP/HTTPS
 */

const express = require('express');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { createMcpServer } = require('./server');

function createMcpRouter(autenticarApiKey) {
  const router = express.Router();
  const activeTransports = new Map();

  // Endpoint de conexão SSE para Agentes de IA
  router.get('/sse', autenticarApiKey, async (req, res) => {
    console.log('[MCP] Nova conexão SSE de Agente de IA iniciada.');

    // Preserva o token na URL de mensagens se tiver sido passado via query
    let messagesEndpoint = '/mcp/messages';
    if (req.query.token) {
      messagesEndpoint += `?token=${encodeURIComponent(req.query.token)}`;
    }

    const transport = new SSEServerTransport(messagesEndpoint, res);
    const mcpServer = createMcpServer();

    activeTransports.set(transport.sessionId, transport);

    req.on('close', () => {
      console.log(`[MCP] Sessão SSE encerrada (${transport.sessionId}).`);
      activeTransports.delete(transport.sessionId);
    });

    try {
      await mcpServer.connect(transport);
    } catch (err) {
      console.error('[MCP] Erro ao conectar transporte SSE:', err.message);
      activeTransports.delete(transport.sessionId);
    }
  });

  // Endpoint para envio de mensagens JSON-RPC da sessão SSE
  router.post('/messages', autenticarApiKey, async (req, res) => {
    const sessionId = req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        sucesso: false,
        erro: 'sessionId é obrigatório nos parâmetros de URL.'
      });
    }

    const transport = activeTransports.get(sessionId);
    if (!transport) {
      return res.status(404).json({
        sucesso: false,
        erro: `Sessão SSE não encontrada ou expirada: ${sessionId}`
      });
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (err) {
      console.error('[MCP] Erro ao processar mensagem JSON-RPC:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ sucesso: false, erro: err.message });
      }
    }
  });

  return router;
}

module.exports = {
  createMcpRouter
};
