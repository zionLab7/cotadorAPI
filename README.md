# 🏥 API Própria de Cotação de Planos de Saúde (Painel do Corretor)

Para integrar ao ChatGPT como plugin e liberar acesso individual aos vendedores, veja [PLUGIN_SETUP.md](PLUGIN_SETUP.md). O pacote portátil está em [`plugin/`](plugin/).

API REST desenvolvida com **Node.js, Express e Playwright** para automação completa de cotações no sistema **Painel do Corretor** (`beta.paineldocorretor.com.br`), permitindo integração direta com **Chatbots (WhatsApp / Evolution API / Typebot / N8N)**, **CRMs** e sistemas internos da corretora.

---

## 🌟 Funcionalidades

- **Cotação Automatizada Headless**: Cria cotações, preenche faixas etárias de vidas e seleciona planos automaticamente sem intervenção humana.
- **Relatório Comparativo Estruturado (JSON)**: Retorna preços detalhados por faixa de idade, totais por plano, acomodação (Apartamento/Enfermaria) e coparticipação.
- **Geração de PDF Oficial**: Faz o download e disponibiliza o PDF original consolidado da cotação para envio direto como anexo no WhatsApp.
- **Mapeamento de Catálogo**: Acesso a **718 variações de planos mapeados** (Amil, Bradesco, Porto Seguro, SulAmérica, Alice, Omint) com busca e filtros.
- **Rede Credenciada**: Extrai hospitais e laboratórios credenciados por plano com filtros regionais.
- **Servidor MCP Oficial (Model Context Protocol)**: Conecta nativamente Agentes de IA (**Claude Desktop**, **Cursor IDE**, **N8N AI Agent**, **LangChain**) via ferramentas (*Tools*) de cotação e catálogo.
- **Camada de Autenticação Segura**: Suporte a Bearer Token, header `x-api-key` e query param `?token=` (`API_SECRET_TOKEN`).
- **Sessão Persistente (`storage_state.json`)**: Reutiliza a sessão autenticada para respostas ultra-rápidas sem necessidade de login a cada requisição.

---

## 🚀 Como Iniciar a API

### 1. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo e configure suas credenciais:
```bash
cp .env.example .env
```

Edite o `.env`:
```env
PORT=3000
HEADLESS=true
PAINEL_USER=seu_email@exemplo.com.br
PAINEL_PASSWORD=sua_senha_aqui
PAINEL_URL=https://beta.paineldocorretor.com.br
```

### 2. Iniciar o Servidor
```bash
npm start
```
A API estará pronta em: `http://localhost:3000`

### 3. Rodar Testes
```bash
npm test
```

---

## 📡 Endpoints da API

### 1. Status do Serviço
`GET /api/status`

Retorna o estado de saúde da API, verificação da sessão ativa e quantidade de planos mapeados no catálogo.

**Exemplo de Resposta:**
```json
{
  "status": "online",
  "servico": "API Própria - Cotação de Planos de Saúde (Painel do Corretor)",
  "versao": "1.0.0",
  "sessaoAtiva": true,
  "totalOperadorasCatalogo": 6,
  "totalPlanosCatalogo": 718,
  "timestamp": "2026-09-22T09:47:01.669Z"
}
```

---

### 2. Listar Operadoras
`GET /api/operadoras`

Retorna todas as operadoras disponíveis e o total de opções cadastradas.

---

### 3. Consultar Catálogo de Planos
`GET /api/catalogo`

Permite buscar e filtrar todo o catálogo de planos mapeados.

**Parâmetros de Consulta (Query Params):**
- `operadora`: Filtra por nome da operadora (ex: `Amil`, `Bradesco`, `Porto`)
- `acomodacao`: `apartamento` ou `enfermaria`
- `coparticipacao`: `true` ou `false`
- `mei`: `true` ou `false`
- `busca`: Termo de busca livre (ex: `Bronze`, `Nacional`, `Platinum`)

**Exemplo:**
`GET /api/catalogo?operadora=Amil&acomodacao=apartamento&coparticipacao=true`

---

### 4. Realizar Cotação
`POST /api/cotacao`

Dispara a cotação no painel e retorna o resultado consolidado e o link do PDF.

**Corpo da Requisição (JSON):**
```json
{
  "titulo": "Cotação Cliente WhatsApp - Família Silva",
  "cidade": "Guarulhos - SP",
  "modalidade": 2,
  "vidas": [
    { "faixa": "24-28", "quantidade": 1 },
    { "faixa": "29-33", "quantidade": 1 },
    { "faixa": "34-38", "quantidade": 1 },
    { "faixa": "49-53", "quantidade": 3 },
    { "faixa": "54-58", "quantidade": 1 }
  ],
  "operadoras": ["Porto Seguro", "Amil", "Bradesco Seguros"]
}
```

**Exemplo de Resposta:**
```json
{
  "sucesso": true,
  "cotacaoId": "01a0c871-5895-7e0d-9816-ec733d9acf7e",
  "titulo": "Cotação Cliente WhatsApp - Família Silva",
  "corretor": {
    "nome": "Corretor Exemplo",
    "email": "corretor@example.com",
    "telefone": "(11) 90000-0000"
  },
  "totalPlanos": 8,
  "planos": [
    {
      "idColuna": 1,
      "plano": "Prata Mais I",
      "operadora": "Porto Seguro",
      "modalidade": "Saúde PME",
      "acomodacao": "Apartamento",
      "coparticipacao": "Sem Coparticipação",
      "valorTotal": 6030.76,
      "faixas": [
        { "faixa": "24 a 28", "quantidade": 1, "valorUnitario": 568.43, "valorTotalFaixa": 568.43 },
        { "faixa": "29 a 33", "quantidade": 1, "valorUnitario": 650.76, "valorTotalFaixa": 650.76 },
        { "faixa": "34 a 38", "quantidade": 1, "valorUnitario": 705.10, "valorTotalFaixa": 705.10 },
        { "faixa": "49 a 53", "quantidade": 3, "valorUnitario": 936.42, "valorTotalFaixa": 2809.26 },
        { "faixa": "54 a 58", "quantidade": 1, "valorUnitario": 1157.01, "valorTotalFaixa": 1157.01 }
      ]
    },
    {
      "idColuna": 2,
      "plano": "Platinum R1",
      "operadora": "Amil",
      "modalidade": "Saúde PME",
      "acomodacao": "Apartamento",
      "coparticipacao": "Parcial",
      "valorTotal": 7199.96,
      "faixas": [...]
    }
  ],
  "pdf": {
    "nomeArquivo": "cotacao-01a0c871-5895-7e0d-9816-ec733d9acf7e.pdf",
    "urlDownload": "/api/cotacao/01a0c871-5895-7e0d-9816-ec733d9acf7e/pdf"
  },
  "linkVisualizacaoWeb": "https://beta.paineldocorretor.com.br/cotacoes/01a0c871-5895-7e0d-9816-ec733d9acf7e/print"
}
```

---

### 5. Download do PDF da Cotação
`GET /api/cotacao/:id/pdf`

Retorna o arquivo PDF pronto para download ou exibição inline no navegador / envio direto no WhatsApp via bot.

---

### 6. Autenticação / Renovação de Sessão
`POST /api/auth/login`

Força a realização do login e atualização do arquivo de sessão `storage_state.json`.

---

## 🤖 Como Integrar com seu Chatbot (Typebot / Evolution API / WhatsApp)

### No Fluxo do Chatbot:
1. O chatbot pergunta a cidade e a idade dos beneficiários.
2. Faz uma chamada HTTP `POST` para `http://SEU_SERVIDOR:3000/api/cotacao`.
3. O chatbot recebe a resposta JSON:
   - Extrai os 3 planos com melhor custo-benefício e digita no WhatsApp:
     > *"Encontrei os melhores planos para você:*  
     > *1. Porto Seguro Prata Mais I (Apartamento): R$ 6.030,76*  
     > *2. Amil Platinum R1 (Apartamento): R$ 7.199,96*  
     > *3. SulAmérica Especial Mais (Apartamento): R$ 7.244,63"*
4. Em seguida, o bot envia a mensagem com o arquivo anexo através da URL do PDF:
   `http://SEU_SERVIDOR:3000/api/cotacao/{cotacaoId}/pdf`.
