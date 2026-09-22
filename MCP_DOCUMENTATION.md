# 🤖 Guia do Servidor MCP (Model Context Protocol)

O **Servidor MCP de Cotação de Planos de Saúde** expõe todo o motor de automação e o catálogo de 718 planos de saúde como **Tools (Ferramentas)** e **Resources (Recursos)** para Agentes de Inteligência Artificial (**Claude Desktop**, **Cursor IDE**, **N8N AI Agents**, **LangChain**, **Flowise**, **Dify**, etc.).

A API REST tradicional continua operando normalmente na porta 3000, e o servidor MCP funciona em modo **híbrido**:
1. **SSE Remoto (Server-Sent Events)**: Atende agentes remotos na VPS via HTTP/HTTPS em `/mcp/sse`.
2. **STDIO Local**: Atende agentes locais (Claude Desktop, Cursor no computador) via linha de comando (`npm run mcp`).

---

## 🛠️ Ferramentas Disponíveis para a IA (Tools)

O agente de IA terá acesso automático às seguintes ferramentas:

### 1. `cotar_planos`
Executa cotação completa no Painel do Corretor, preenchendo o formulário com as idades das vidas e selecionando os planos solicitados.
- **Parâmetros**:
  - `vidas` *(obrigatório)*: Array de faixas e quantidades, ex: `[{"faixa": "24-28", "quantidade": 1}, {"faixa": "49-53", "quantidade": 2}]`.
  - `titulo` *(opcional)*: Nome da cotação (ex: "Cotação PME - Família Silva").
  - `cidade` *(opcional)*: Cidade e UF da cotação (ex: "Guarulhos - SP", "São Paulo - SP"). Padrão: `"Guarulhos - SP"`.
  - `modalidade` *(opcional)*: `2` para PME (padrão), `1` para Individual, `3` para Adesão.
  - `operadoras` *(opcional)*: Lista de operadoras para filtrar (ex: `["Amil", "Bradesco Seguros"]`). Se omitido, cota planos de todas as 6 operadoras.
- **Retorno**:
  - Tabela consolidada com preços por faixa etária, valor total por plano, acomodação, coparticipação e link para download do PDF oficial.

### 2. `consultar_catalogo`
Consulta a base mapeada de 718 planos de saúde com filtros rápidos.
- **Parâmetros**:
  - `operadora`: `"Amil"`, `"Bradesco Seguros"`, `"SulAmérica"`, `"Porto Seguro"`, `"Alice"`, `"Omint"`.
  - `acomodacao`: `"apartamento"` ou `"enfermaria"`.
  - `coparticipacao`: `true` (com coparticipação) ou `false` (sem coparticipação).
  - `mei`: `true` (planos compatíveis com MEI).
  - `busca`: Termo de busca no nome do plano ou produto (ex: `"Bronze"`, `"Especial"`, `"Nacional"`).

### 3. `listar_operadoras`
Retorna as 6 operadoras homologadas, quantidade de planos de cada uma e linhas de produtos.
- **Parâmetros**: Nenhum.

### 4. `verificar_status_cotador`
Verifica a saúde da API, se a sessão com o Painel do Corretor está ativa e o total de planos mapeados.
- **Parâmetros**: Nenhum.

---

## 📚 Recursos Disponíveis para a IA (Resources)

- `catalogo://planos`: Acesso direto ao JSON completo com os 718 planos catalogados.
- `catalogo://operadoras`: Resumo estruturado das operadoras e linhas disponíveis.

---

## 🔌 Como Integrar com Agentes de IA

---

### 1. Claude Desktop (Modo STDIO)

Para que o aplicativo **Claude Desktop** possa cotar planos de saúde diretamente pelo chat:

1. Abra o arquivo de configuração do Claude Desktop:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. Adicione o servidor em `mcpServers`:
   ```json
   {
     "mcpServers": {
       "cotador-planos": {
         "command": "node",
         "args": [
           "/CAMINHO_ABSOLUTO_DO_PROJETO/src/mcp/stdio.js"
         ],
         "env": {
           "PAINEL_USER": "jefferson@allcc.com.br",
           "PAINEL_PASSWORD": "sua_senha_do_painel",
           "HEADLESS": "true"
         }
       }
     }
   }
   ```
3. Reinicie o Claude Desktop. O ícone de martelo (Tools) aparecerá com as 4 ferramentas do cotador ativas!

---

### 2. Cursor IDE (Modo STDIO ou SSE Remoto)

No Cursor:
1. Vá em **Settings** -> **Features** -> **MCP Servers** -> **Add New MCP Server**.
2. **Opção A - STDIO (Local)**:
   - **Name**: `cotador`
   - **Type**: `command`
   - **Command**: `node /CAMINHO_ABSOLUTO_DO_PROJETO/src/mcp/stdio.js`
3. **Opção B - SSE (Remoto na VPS)**:
   - **Name**: `cotador-vps`
   - **Type**: `sse`
   - **URL**: `https://cotador.suacorretora.com.br/mcp/sse?token=SEU_TOKEN_SECRETO`

---

### 3. N8N (Nó de Agente de IA com MCP Tool)

No seu fluxo do N8N com o nó **AI Agent**:
1. Conecte um nó **Model Context Protocol Tool** (ou **HTTP Request Tool**).
2. Configure a URL SSE do servidor:
   - **Endpoint SSE**: `https://cotador.suacorretora.com.br/mcp/sse`
   - **Headers**:
     - `Authorization`: `Bearer SEU_TOKEN_SECRETO`
     *(Ou passe na URL: `https://cotador.suacorretora.com.br/mcp/sse?token=SEU_TOKEN_SECRETO`)*
3. O N8N carregará dinamicamente as ferramentas `cotar_planos`, `consultar_catalogo` e `listar_operadoras`!

---

### 4. LangChain / Python

```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    server_url = "https://cotador.suacorretora.com.br/mcp/sse?token=SEU_TOKEN_SECRETO"
    
    async with sse_client(server_url) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            
            # 1. Lista ferramentas disponíveis
            tools = await session.list_tools()
            print("Ferramentas disponíveis:", [t.name for t in tools.tools])
            
            # 2. Executa cotação via Agente
            resultado = await session.call_tool(
                "cotar_planos",
                arguments={
                    "titulo": "Cotação Agente Python",
                    "cidade": "Guarulhos - SP",
                    "modalidade": 2,
                    "vidas": [
                        {"faixa": "24-28", "quantidade": 1},
                        {"faixa": "34-38", "quantidade": 1}
                    ]
                }
            )
            print("Resultado da cotação:", resultado.content[0].text)

asyncio.run(main())
```

---

## 💬 Exemplo de Prompt para o Agente de IA

Depois de conectado ao Claude Desktop, Cursor ou N8N, você pode simplesmente conversar em linguagem natural com a IA:

> *"Cote para mim planos de saúde PME em Guarulhos para 3 pessoas: uma de 26 anos, uma de 35 anos e outra de 52 anos. Filtre apenas Amil e Bradesco Seguros com acomodação em apartamento. No final, me dê os valores e o link do PDF."*

O agente de IA automaticamente:
1. Chamará a tool `cotar_planos` com:
   - `cidade`: `"Guarulhos - SP"`
   - `modalidade`: `2`
   - `vidas`: `[{"faixa": "24-28", "quantidade": 1}, {"faixa": "34-38", "quantidade": 1}, {"faixa": "49-53", "quantidade": 1}]`
   - `operadoras`: `["Amil", "Bradesco Seguros"]`
2. Interpretará a resposta JSON com os valores totais e faixas.
3. Apresentará um resumo formatado para o usuário e entregará o link oficial do PDF!
