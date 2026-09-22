/**
 * Servidor MCP (Model Context Protocol) para Cotação de Planos de Saúde
 * Expõe Tools e Resources para Agentes de Inteligência Artificial
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const fs = require('fs');
const config = require('../config');
const { listarOperadoras, consultarPlanos, carregarCatalogo } = require('../catalogo');
const { executarCotacao } = require('../cotador');

function createMcpServer() {
  const server = new McpServer({
    name: 'cotador-planos-saude-mcp',
    version: '1.0.0',
    description: 'Servidor MCP para automação e cotação de planos de saúde no Painel do Corretor (Amil, Bradesco Seguros, SulAmérica, Porto Seguro, Alice, Omint)'
  });

  // 1. Tool: listar_operadoras
  server.tool(
    'listar_operadoras',
    'Lista todas as 6 operadoras homologadas com quantidade de planos mapeados e linhas disponíveis.',
    {},
    async () => {
      try {
        const operadoras = listarOperadoras();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ sucesso: true, total: operadoras.length, operadoras }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Erro ao listar operadoras: ${err.message}` }]
        };
      }
    }
  );

  // 2. Tool: consultar_catalogo
  server.tool(
    'consultar_catalogo',
    'Consulta e filtra o catálogo de 718 planos de saúde homologados (Amil, Bradesco Seguros, SulAmérica, Porto Seguro, Alice, Omint).',
    {
      operadora: z.string().optional().describe('Nome da operadora (ex: Amil, Bradesco Seguros, SulAmérica, Porto Seguro, Alice, Omint)'),
      acomodacao: z.enum(['apartamento', 'enfermaria']).optional().describe('Tipo de acomodação desejada'),
      coparticipacao: z.boolean().optional().describe('true para planos com coparticipação, false para sem coparticipação'),
      mei: z.boolean().optional().describe('true para filtrar planos compatíveis com MEI'),
      busca: z.string().optional().describe('Termo de busca para pesquisar no nome do plano ou produto')
    },
    async (args) => {
      try {
        const planos = consultarPlanos(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sucesso: true,
                totalEncontrados: planos.length,
                filtrosAplicados: args,
                planos: planos.slice(0, 50), // Limita em 50 para não sobrecarregar o contexto da LLM
                aviso: planos.length > 50 ? `Mostrando primeiros 50 de ${planos.length} planos encontrados.` : undefined
              }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Erro ao consultar catálogo: ${err.message}` }]
        };
      }
    }
  );

  // 3. Tool: cotar_planos
  server.tool(
    'cotar_planos',
    'Executa a cotação automatizada no Painel do Corretor e retorna valores por faixa, total por plano, acomodação e coparticipação. Retorna o ID do PDF, sem link público.',
    {
      titulo: z.string().optional().describe('Nome identificador da cotação (ex: "Cotação PME - Família Silva")'),
      cidade: z.string().optional().describe('Cidade e UF da cotação (ex: "Guarulhos - SP", "São Paulo - SP")'),
      modalidade: z.number().int().optional().describe('Modalidade: 2 para Saúde PME (padrão), 1 para Individual/Familiar, 3 para Coletivo Adesão'),
      vidas: z.array(
        z.object({
          faixa: z.string().describe('Faixa etária ANS (ex: "00-18", "19-23", "24-28", "29-33", "34-38", "39-43", "44-48", "49-53", "54-58", "59+")'),
          quantidade: z.number().int().min(1).describe('Número de pessoas nesta faixa')
        })
      ).min(1).describe('Lista de pessoas agrupadas por faixa etária'),
      operadoras: z.array(z.string()).optional().describe('Lista opcional de operadoras para cotar (ex: ["Amil", "Bradesco Seguros"]). Se omitido, cota todas as disponíveis.')
    },
    async (args) => {
      try {
        const resultado = await executarCotacao({
          titulo: args.titulo || 'Cotação via Agente IA (MCP)',
          cidade: args.cidade || 'Guarulhos - SP',
          modalidade: args.modalidade || 2,
          vidas: args.vidas,
          operadoras: args.operadoras
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sucesso: true,
                cotacaoId: resultado.cotacaoId,
                titulo: resultado.titulo,
                totalPlanos: resultado.totalPlanos,
                planos: resultado.planos,
                resumoHospitais: resultado.resumoHospitais,
                pdf: {
                  nomeArquivo: resultado.pdf.nomeArquivo,
                  disponivel: fs.existsSync(resultado.pdf.caminhoLocal)
                }
              }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Não foi possível executar a cotação. Consulte os logs do servidor.' }]
        };
      }
    }
  );

  // 4. Tool: verificar_status_cotador
  server.tool(
    'verificar_status_cotador',
    'Verifica a saúde da API do cotador, integridade da sessão no Painel do Corretor e total de planos cadastrados.',
    {},
    async () => {
      try {
        const sessionExists = fs.existsSync(config.STORAGE_STATE_PATH);
        const catalogo = carregarCatalogo();
        const totalPlanosMapeados = Object.values(catalogo).reduce((acc, cur) => acc + cur.length, 0);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'online',
                sessaoPainelAtiva: sessionExists,
                totalOperadoras: Object.keys(catalogo).length,
                totalPlanos: totalPlanosMapeados
              }, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Erro ao verificar status: ${err.message}` }]
        };
      }
    }
  );

  // Resources
  server.resource(
    'catalogo-planos',
    'catalogo://planos',
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(carregarCatalogo(), null, 2),
          mimeType: 'application/json'
        }
      ]
    })
  );

  server.resource(
    'catalogo-operadoras',
    'catalogo://operadoras',
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(listarOperadoras(), null, 2),
          mimeType: 'application/json'
        }
      ]
    })
  );

  return server;
}

module.exports = {
  createMcpServer
};
