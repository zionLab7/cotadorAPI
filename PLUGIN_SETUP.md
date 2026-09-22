# Plugin All Cubo Cotador para ChatGPT

Este repositório contém o servidor MCP e um pacote portátil em `plugin/`. O endpoint novo é `POST /mcp` (Streamable HTTP); `/mcp/sse` e o cliente local `stdio` continuam disponíveis. O MCP novo exige OAuth; sem configuração responde `503`, sem token responde `401`.

## Antes de instalar

1. Escolha e configure um provedor OAuth 2.1/OIDC que ofereça authorization code + PKCE S256, metadados de descoberta e JWKS. Permita o cliente/redirect URI indicado pelo ChatGPT durante a criação da conexão. O token de **acesso** deve ser um JWT RS256 ou ES256 com `iss` igual ao provedor, `aud` igual à URL completa do MCP, `scope` contendo `cotador:use`, e `email` + `email_verified: true`. Configure no provedor somente os funcionários autorizados.
2. Defina no deploy `MCP_PUBLIC_URL=https://DOMINIO-REAL/mcp`, `MCP_OAUTH_ISSUER`, `MCP_OAUTH_JWKS_URI` e `MCP_ALLOWED_EMAILS` com os e-mails autorizados separados por vírgulas. Mantenha `API_SECRET_TOKEN` reservado à API REST/integrações legadas; ele não autentica o endpoint `/mcp` novo.
3. Faça o deploy com HTTPS e verifique `GET https://DOMINIO-REAL/.well-known/oauth-protected-resource`, `POST https://DOMINIO-REAL/mcp` sem token (deve retornar 401 com `WWW-Authenticate`) e uma conexão autenticada pelo MCP Inspector. Confira que as quatro ferramentas aparecem e faça uma cotação controlada.
4. Substitua a URL de exemplo em `plugin/mcp.json` pelo mesmo endpoint HTTPS real; publique uma versão revisada do pacote. Enquanto o placeholder estiver presente, **não instale o pacote**. O repositório não contém o endereço real confirmado da implantação.
5. No ChatGPT, ative o modo de desenvolvedor em Configurações > Segurança e login, abra Plug-ins > `+` e adicione a URL do MCP. Conclua o login OAuth e confirme a lista de ferramentas. Para disponibilizar à equipe, publique o plugin ou conexão no workspace conforme as permissões de administrador; cada pessoa deve entrar com sua própria conta do provedor. A publicação no workspace depende do plano e das políticas do workspace. O pacote em `plugin/` pode ser usado no fluxo de distribuição do workspace.

O PDF da cotação continua salvo no servidor. O resultado MCP fornece apenas `cotacaoId`, nome do arquivo e indicador de disponibilidade. Para entregar o PDF no ChatGPT, implemente um download com autorização por usuário ou link temporário assinado; não anexe `API_SECRET_TOKEN` à URL. A rota REST de PDF existente continua com o contrato anterior para clientes já integrados.

## Verificação local

```bash
npm ci --ignore-scripts
node test_api.js
node test_mcp.js
node test_mcp_http.js
```

`npm test` também executa `test_parser.js`, que precisa de um fixture HTML em `raw_capture/` não incluído no repositório.
