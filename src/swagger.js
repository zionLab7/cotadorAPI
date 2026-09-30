/**
 * Especificação OpenAPI 3.0 / Swagger para a API de Cotação de Planos de Saúde
 * Permite documentação interativa e testes diretos ("Try it out") com autenticação por Token
 */

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API de Cotação de Planos de Saúde (Painel do Corretor)',
    version: '1.0.0',
    description: `
### 🏥 Visão Geral
Esta API REST automatiza o sistema **Painel do Corretor** (\`beta.paineldocorretor.com.br\`) utilizando **Playwright Headless**, permitindo cotações em tempo real e consulta a uma base consolidada de **718 variações de planos** de saúde.

Criada sob medida para integração com:
- **Chatbots no WhatsApp**: Typebot, Evolution API, Z-API, Baileys, Chatwoot.
- **Automações**: N8N, Make, Zapier, Webhooks.
- **CRMs e Plataformas de Vendas**: HubSpot, RD Station, Bitrix24, sistemas internos.

---

### 🔒 Autenticação e Segurança (Como Usar o "Authorize")
A API é protegida por um token secreto configurado em \`API_SECRET_TOKEN\`.
Para testar os endpoints protegidos nesta documentação:
1. Clique no botão verde **Authorize 🔒** no topo direito.
2. Em **bearerAuth**, cole o seu token (ex: o valor configurado na sua VPS ou \`.env\`).
3. Clique em **Authorize** e feche a janela.
4. Agora todos os botões **Try it out** enviarão automaticamente a sua chave!

*Nota: Em links compartilhados com clientes no WhatsApp (como o download do PDF), você também pode usar o parâmetro de URL \`?token=SEU_TOKEN\`.*

---

### 📋 Regras de Negócio e Validações

#### 1. Faixas Etárias ANS (Obrigatório informar pelo menos 1 vida)
O cotador opera estritamente com as 10 faixas oficiais da ANS:
- \`00-18\`: 0 a 18 anos
- \`19-23\`: 19 a 23 anos
- \`24-28\`: 24 a 28 anos
- \`29-33\`: 29 a 33 anos
- \`34-38\`: 34 a 38 anos
- \`39-43\`: 39 a 43 anos
- \`44-48\`: 44 a 48 anos
- \`49-53\`: 49 a 53 anos
- \`54-58\`: 54 a 58 anos
- \`59+\`: 59 anos ou mais

#### 2. Modalidades de Contratação
- \`2\`: **Saúde PME** (MEI / CNPJ a partir de 1 ou 2 vidas) - *Padrão recomendado*.
- \`1\`: **Individual / Familiar** (Pessoa Física).
- \`3\`: **Coletivo por Adesão** (Entidades de classe / Profissionais liberais).

#### 3. Operadoras Homologadas
- **Amil** (Linhas Bronze, Prata, Ouro, Black, etc.)
- **Bradesco Seguros** (Linhas Efetivo, Nacional, Nacional Plus, etc.)
- **Porto Seguro** (Linhas Bronze, Prata, Ouro, Diamante)
- **SulAmérica** (Linhas Direto, Exato, Clássico, Especial, Executivo)
- **Alice** (Equilíbrio, Conforto, Super Conforto)
- **Omint** (Linhas Skill, Corporativo, Premium)
    `
  },
  servers: [
    {
      url: '/',
      description: 'Servidor Atual (Local / Produção VPS)'
    }
  ],
  tags: [
    {
      name: 'Status & Diagnóstico',
      description: 'Verificação de integridade da API, saúde da sessão e catálogo indexado'
    },
    {
      name: 'Cotação & PDF',
      description: 'Criação de cotações automatizadas no Painel do Corretor e download de PDF oficial'
    },
    {
      name: 'Catálogo de Planos',
      description: 'Consulta rápida e filtrada à base de 718 planos de saúde'
    },
    {
      name: 'Autenticação no Painel',
      description: 'Renovação e testes de credenciais no Painel do Corretor'
    }
  ],
  paths: {
    '/api/status': {
      get: {
        tags: ['Status & Diagnóstico'],
        summary: 'Verifica o status da API, da sessão e métricas',
        description: 'Endpoint **público** para verificação de funcionamento (healthcheck), monitoramento 24h (Portainer / Uptime Kuma) e diagnóstico.',
        responses: {
          '200': {
            description: 'API online e operacional',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusResponse' },
                example: {
                  status: 'online',
                  servico: 'API Própria - Cotação de Planos de Saúde (Painel do Corretor)',
                  versao: '1.0.0',
                  autenticacaoAtiva: true,
                  sessaoAtiva: true,
                  totalOperadorasCatalogo: 6,
                  totalPlanosCatalogo: 718,
                  timestamp: '2026-09-30T10:00:00.000Z'
                }
              }
            }
          }
        }
      }
    },
    '/api/operadoras': {
      get: {
        tags: ['Catálogo de Planos'],
        summary: 'Lista as operadoras homologadas e contagem de planos',
        description: 'Retorna a lista completa das 6 operadoras cadastradas na base, incluindo o número de planos mapeados e linhas de produtos disponíveis.',
        security: [
          { bearerAuth: [] },
          { apiKeyHeader: [] },
          { apiKeyQuery: [] }
        ],
        responses: {
          '200': {
            description: 'Lista de operadoras retornada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OperadorasResponse' },
                example: {
                  sucesso: true,
                  total: 6,
                  operadoras: [
                    {
                      operadora: 'SulAmérica',
                      operadoraId: 4,
                      totalPlanos: 348,
                      linhas: ['Direto', 'Exato', 'Clássico', 'Especial Mais', 'Executivo']
                    },
                    {
                      operadora: 'Bradesco Seguros',
                      operadoraId: 3975,
                      totalPlanos: 144,
                      linhas: ['Efetivo', 'Nacional Flex', 'Nacional Top', 'Nacional Plus']
                    },
                    {
                      operadora: 'Amil',
                      operadoraId: 93,
                      totalPlanos: 86,
                      linhas: ['Linha Selecionada', 'Linha Amil', 'Amil One']
                    },
                    {
                      operadora: 'Porto Seguro',
                      operadoraId: 30,
                      totalPlanos: 58,
                      linhas: ['Linha Pro', 'Linha Mais', 'Linha Max']
                    },
                    {
                      operadora: 'Omint',
                      operadoraId: 28,
                      totalPlanos: 54,
                      linhas: ['Linha Skill', 'Linha Corporate', 'Linha Premium']
                    },
                    {
                      operadora: 'Alice',
                      operadoraId: 4036,
                      totalPlanos: 28,
                      linhas: ['Linha Alice']
                    }
                  ]
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          }
        }
      }
    },
    '/api/catalogo': {
      get: {
        tags: ['Catálogo de Planos'],
        summary: 'Consulta o catálogo de planos com filtros',
        description: 'Permite consultar e filtrar todo o catálogo de planos mapeados. Ideal para chatbots sugerirem opções ao cliente ou para preenchimento de selects no front-end.',
        security: [
          { bearerAuth: [] },
          { apiKeyHeader: [] },
          { apiKeyQuery: [] }
        ],
        parameters: [
          {
            name: 'operadora',
            in: 'query',
            description: 'Nome da operadora (ex: Amil, Bradesco Seguros, SulAmérica, Porto Seguro, Alice, Omint)',
            required: false,
            schema: { type: 'string' },
            example: 'Amil'
          },
          {
            name: 'acomodacao',
            in: 'query',
            description: 'Tipo de acomodação desejada',
            required: false,
            schema: {
              type: 'string',
              enum: ['apartamento', 'enfermaria']
            },
            example: 'apartamento'
          },
          {
            name: 'coparticipacao',
            in: 'query',
            description: 'Filtrar por planos com coparticipação (true) ou sem coparticipação (false)',
            required: false,
            schema: { type: 'boolean' },
            example: true
          },
          {
            name: 'mei',
            in: 'query',
            description: 'Filtrar planos com aceitação de MEI (Microempreendedor Individual)',
            required: false,
            schema: { type: 'boolean' },
            example: true
          },
          {
            name: 'busca',
            in: 'query',
            description: 'Termo de busca textual no nome do plano ou produto',
            required: false,
            schema: { type: 'string' },
            example: 'Bronze'
          }
        ],
        responses: {
          '200': {
            description: 'Planos filtrados retornados com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CatalogoResponse' }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          }
        }
      }
    },
    '/api/cotacao': {
      post: {
        tags: ['Cotação & PDF'],
        summary: 'Executa uma cotação completa e gera o PDF',
        description: `
Dispara a cotação no **Painel do Corretor** em background via Playwright Headless.
O robô:
1. Reutiliza os cookies salvos em \`storage_state.json\` (ou renova o login automaticamente).
2. Acessa a página de nova cotação e preenche o título, modalidade e cidade.
3. Preenche as quantidades de pessoas nas faixas de idade informadas.
4. Seleciona os planos comparativos das operadoras especificadas.
5. Captura o relatório consolidado de preços por faixa, totais e rede de hospitais credenciados.
6. Renderiza e salva o arquivo **PDF oficial** pronto para download.
        `,
        security: [
          { bearerAuth: [] },
          { apiKeyHeader: [] },
          { apiKeyQuery: [] }
        ],
        requestBody: {
          required: true,
          description: 'Dados da cotação a ser realizada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CotacaoRequest' },
              examples: {
                cotacaoPme3Vidas: {
                  summary: 'Cotação PME (3 Vidas em Guarulhos - SP)',
                  description: 'Exemplo típico de cotação para pequena empresa familiar com 3 beneficiários.',
                  value: {
                    titulo: 'Cotação PME - Família Silva (3 vidas)',
                    cidade: 'Guarulhos - SP',
                    modalidade: 2,
                    vidas: [
                      { faixa: '24-28', quantidade: 1 },
                      { faixa: '34-38', quantidade: 1 },
                      { faixa: '49-53', quantidade: 1 }
                    ],
                    operadoras: ['Amil', 'Bradesco Seguros', 'Porto Seguro', 'SulAmérica']
                  }
                },
                cotacaoTodasOperadoras: {
                  summary: 'Cotação Geral (Sem filtro de operadoras)',
                  description: 'Cota planos de todas as 6 operadoras homologadas para 2 vidas.',
                  value: {
                    titulo: 'Cotação Comparativa Geral - 2 Vidas',
                    cidade: 'São Paulo - SP',
                    modalidade: 2,
                    vidas: [
                      { faixa: '29-33', quantidade: 2 }
                    ]
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Cotação processada com sucesso!',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CotacaoResponse' }
              }
            }
          },
          '400': {
            description: 'Requisição inválida (ex: nenhuma vida informada)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '500': {
            description: 'Erro durante a automação no painel',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/cotacao/{id}/pdf': {
      get: {
        tags: ['Cotação & PDF'],
        summary: 'Download do PDF oficial da cotação',
        description: `
Faz o download ou visualização inline do PDF original gerado pelo cotador.
O arquivo é salvo no disco do servidor e servido diretamente com Content-Type \`application/pdf\`.

**Dica para Chatbots:** Ao enviar este link no WhatsApp, você pode incluir o token na query string:
\`https://cotador.seudominio.com.br/api/cotacao/{id}/pdf?token=SEU_TOKEN_SECRETO\`
        `,
        security: [
          { bearerAuth: [] },
          { apiKeyHeader: [] },
          { apiKeyQuery: [] }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID único da cotação gerada (retornado no campo \`cotacaoId\` do POST /api/cotacao)',
            schema: { type: 'string' },
            example: '01a0c871-5895-7e0d-9816-ec733d9acf7e'
          },
          {
            name: 'token',
            in: 'query',
            required: false,
            description: 'Token de autenticação da API (opcional se enviado via header Authorization)',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Arquivo PDF retornado com sucesso',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary'
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          },
          '404': {
            description: 'Arquivo PDF não encontrado para este ID',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação no Painel'],
        summary: 'Forçar login e atualização do storage_state.json',
        description: 'Executa a rotina de login no Auth0 do Painel do Corretor utilizando as credenciais informadas (ou as definidas no `.env`) e salva os novos cookies em disco.',
        security: [
          { bearerAuth: [] },
          { apiKeyHeader: [] },
          { apiKeyQuery: [] }
        ],
        requestBody: {
          required: false,
          description: 'Credenciais opcionais. Se omitido, usará PAINEL_USER e PAINEL_PASSWORD do ambiente.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: {
                email: 'jefferson@allcc.com.br',
                password: 'sua_senha_aqui'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login realizado com sucesso e cookies atualizados',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' }
              }
            }
          },
          '401': {
            description: 'Credenciais inválidas no Painel ou Token da API ausente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        description: 'Insira o token de segurança configurado na variável de ambiente `API_SECRET_TOKEN`.'
      },
      apiKeyHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Token enviado via cabeçalho customizado `x-api-key`.'
      },
      apiKeyQuery: {
        type: 'apiKey',
        in: 'query',
        name: 'token',
        description: 'Token enviado via parâmetro de URL `?token=...`.'
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Acesso não autorizado. Token ausente ou inválido.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              sucesso: false,
              erro: 'Acesso não autorizado. Token de API ausente ou inválido.',
              ajuda: 'Envie o cabeçalho "Authorization: Bearer <SEU_TOKEN>" ou "x-api-key: <SEU_TOKEN>" ou "?token=<SEU_TOKEN>"'
            }
          }
        }
      }
    },
    schemas: {
      StatusResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'online' },
          servico: { type: 'string', example: 'API Própria - Cotação de Planos de Saúde (Painel do Corretor)' },
          versao: { type: 'string', example: '1.0.0' },
          autenticacaoAtiva: { type: 'boolean', example: true },
          servidorMcpAtivo: { type: 'boolean', example: true },
          sessaoAtiva: { type: 'boolean', example: true },
          totalOperadorasCatalogo: { type: 'integer', example: 6 },
          totalPlanosCatalogo: { type: 'integer', example: 718 },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      OperadorasResponse: {
        type: 'object',
        properties: {
          sucesso: { type: 'boolean', example: true },
          total: { type: 'integer', example: 6 },
          operadoras: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                operadora: { type: 'string', example: 'Amil' },
                operadoraId: { type: 'integer', example: 93 },
                totalPlanos: { type: 'integer', example: 86 },
                linhas: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['Linha Selecionada', 'Linha Amil', 'Amil One']
                }
              }
            }
          }
        }
      },
      CatalogoResponse: {
        type: 'object',
        properties: {
          sucesso: { type: 'boolean', example: true },
          total: { type: 'integer', example: 62 },
          filtrosAplicados: { type: 'object' },
          planos: {
            type: 'array',
            items: { $ref: '#/components/schemas/PlanoCatalogo' }
          }
        }
      },
      PlanoCatalogo: {
        type: 'object',
        properties: {
          key: { type: 'string', example: '93-67980-88365-' },
          operadora: { type: 'string', example: 'Amil' },
          operadoraId: { type: 'integer', example: 93 },
          produto: { type: 'string', example: 'Amil Saúde - Interior I' },
          produtoId: { type: 'integer', example: 8798 },
          plano: { type: 'string', example: 'Bronze SP Mais' },
          planoId: { type: 'integer', example: 67980 },
          acomodacao: { type: 'string', example: 'Apartamento' },
          tabela: { type: 'string', example: 'Linha Amil' },
          tabelaId: { type: 'integer', example: 88365 },
          coparticipacao: { type: 'boolean', example: true },
          coparticipacaoTipo: { type: 'string', example: 'Parcial ' },
          mei: { type: 'boolean', example: true },
          qtdVidaMin: { type: 'integer', example: 5 },
          qtdVidaMax: { type: 'integer', example: 29 }
        }
      },
      FaixaVidaRequest: {
        type: 'object',
        required: ['faixa', 'quantidade'],
        properties: {
          faixa: {
            type: 'string',
            description: 'Faixa etária ANS (00-18, 19-23, 24-28, 29-33, 34-38, 39-43, 44-48, 49-53, 54-58, 59+)',
            example: '24-28'
          },
          quantidade: {
            type: 'integer',
            minimum: 1,
            description: 'Quantidade de vidas nesta faixa etária',
            example: 1
          }
        }
      },
      CotacaoRequest: {
        type: 'object',
        required: ['vidas'],
        properties: {
          titulo: {
            type: 'string',
            description: 'Título ou identificador da cotação',
            example: 'Cotação PME - Família Silva'
          },
          cidade: {
            type: 'string',
            description: 'Cidade e UF da contratação',
            default: 'Guarulhos - SP',
            example: 'Guarulhos - SP'
          },
          modalidade: {
            type: 'integer',
            description: '2: Saúde PME (padrão), 1: Individual/Familiar, 3: Coletivo por Adesão',
            default: 2,
            example: 2
          },
          vidas: {
            type: 'array',
            description: 'Lista de vidas agrupadas por faixa etária (mínimo 1 vida)',
            items: { $ref: '#/components/schemas/FaixaVidaRequest' },
            example: [
              { faixa: '24-28', quantidade: 1 },
              { faixa: '34-38', quantidade: 1 },
              { faixa: '49-53', quantidade: 1 }
            ]
          },
          operadoras: {
            type: 'array',
            description: 'Filtro opcional de operadoras. Se omitido, cota planos de todas as operadoras homologadas.',
            items: { type: 'string' },
            example: ['Amil', 'Bradesco Seguros', 'Porto Seguro', 'SulAmérica']
          }
        }
      },
      FaixaPrecoDetalhe: {
        type: 'object',
        properties: {
          faixa: { type: 'string', example: '24 a 28' },
          quantidade: { type: 'integer', example: 1 },
          valorUnitario: { type: 'number', example: 568.43 },
          valorTotalFaixa: { type: 'number', example: 568.43 }
        }
      },
      PlanoCotadoResultado: {
        type: 'object',
        properties: {
          idColuna: { type: 'integer', example: 1 },
          plano: { type: 'string', example: 'Prata Mais I' },
          operadora: { type: 'string', example: 'Porto Seguro' },
          modalidade: { type: 'string', example: 'Saúde PME' },
          acomodacao: { type: 'string', example: 'Apartamento' },
          coparticipacao: { type: 'string', example: 'Sem Coparticipação' },
          valorTotal: { type: 'number', example: 6030.76 },
          faixas: {
            type: 'array',
            items: { $ref: '#/components/schemas/FaixaPrecoDetalhe' }
          }
        }
      },
      CotacaoResponse: {
        type: 'object',
        properties: {
          sucesso: { type: 'boolean', example: true },
          cotacaoId: { type: 'string', example: '01a0c871-5895-7e0d-9816-ec733d9acf7e' },
          titulo: { type: 'string', example: 'Cotação PME - Família Silva' },
          corretor: {
            type: 'object',
            properties: {
              nome: { type: 'string', example: 'Jefferson Souza' },
              email: { type: 'string', example: 'jefferson@allcc.com.br' },
              telefone: { type: 'string', example: '(11) 95025-6952' }
            }
          },
          totalPlanos: { type: 'integer', example: 4 },
          planos: {
            type: 'array',
            items: { $ref: '#/components/schemas/PlanoCotadoResultado' }
          },
          pdf: {
            type: 'object',
            properties: {
              nomeArquivo: { type: 'string', example: 'cotacao-01a0c871-5895-7e0d-9816-ec733d9acf7e.pdf' },
              urlDownload: { type: 'string', example: '/api/cotacao/01a0c871-5895-7e0d-9816-ec733d9acf7e/pdf' }
            }
          },
          linkVisualizacaoWeb: {
            type: 'string',
            example: 'https://beta.paineldocorretor.com.br/cotacoes/01a0c871-5895-7e0d-9816-ec733d9acf7e/print'
          }
        }
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', example: 'jefferson@allcc.com.br' },
          password: { type: 'string', example: 'sua_senha_secreta' }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          sucesso: { type: 'boolean', example: true },
          mensagem: { type: 'string', example: 'Login realizado com sucesso e sessão atualizada.' },
          usuario: { type: 'string', example: 'jefferson@allcc.com.br' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          sucesso: { type: 'boolean', example: false },
          erro: { type: 'string', example: 'Descrição detalhada do erro' },
          detalhes: { type: 'string' },
          ajuda: { type: 'string' }
        }
      }
    }
  }
};

module.exports = {
  swaggerSpec
};
