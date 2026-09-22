# Plugin All Cubo Cotador para ChatGPT

Este repositório contém o servidor MCP e um pacote portátil em `plugin/`. O endpoint novo é `POST /mcp` (Streamable HTTP); `/mcp/sse` e o cliente local `stdio` continuam disponíveis. O MCP novo exige OAuth; sem configuração responde `503`, sem token responde `401`.

## Antes de instalar

1. Configure um provedor OAuth 2.1/OIDC com authorization code + PKCE S256, metadados de descoberta e JWKS. O Auth0 é uma opção no plano gratuito. Registre uma API com identificador exatamente `https://cotador.camaleao.cloud/mcp`, crie a permissão `cotador:use`, habilite o Resource Parameter Compatibility Profile e CIMD (ou DCR com políticas de registro restritas). Permita o cliente e o redirect URI indicados pelo ChatGPT ao criar a conexão. O token de **acesso** deve ser um JWT RS256 ou ES256 com `iss` igual ao provedor, `aud` incluindo a URL do MCP e `scope` contendo `cotador:use`.
2. No Auth0, crie e implante uma Action de Post Login que inclua e-mail e verificação nos claims do token de acesso. Substitua o endereço se o domínio do MCP mudar:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const audience = 'https://cotador.camaleao.cloud/mcp';
     if (event.resource_server?.identifier !== audience) return;
     api.accessToken.setCustomClaim(`${audience}/claims/email`, event.user.email);
     api.accessToken.setCustomClaim(`${audience}/claims/email_verified`, event.user.email_verified === true);
   };
   ```

3. Nas variáveis da Stack no Portainer, defina `MCP_PUBLIC_URL=https://cotador.camaleao.cloud/mcp`, `MCP_OAUTH_ISSUER` (exatamente o valor `issuer` publicado pelo Auth0, incluindo a barra final se houver), `MCP_OAUTH_JWKS_URI` (URL `jwks_uri` da descoberta do provedor) e `MCP_ALLOWED_EMAILS` (e-mails autorizados separados por vírgulas). Confirme que `COTADOR_DOMAIN=cotador.camaleao.cloud` e `PAINEL_USER`, `PAINEL_PASSWORD` e `API_SECRET_TOKEN` continuam preenchidos. O `API_SECRET_TOKEN` não autentica o endpoint MCP novo.
4. Faça o deploy com HTTPS e verifique `GET https://cotador.camaleao.cloud/.well-known/oauth-protected-resource`, `POST https://cotador.camaleao.cloud/mcp` sem token (deve retornar 401 com `WWW-Authenticate`) e uma conexão autenticada pelo MCP Inspector. Confira as quatro ferramentas e faça uma cotação controlada. O endereço já está em `plugin/mcp.json`, mas a instalação só funcionará depois de ativar OAuth no Auth0.
5. No ChatGPT, ative o modo de desenvolvedor em Configurações > Segurança e login, abra Plug-ins > `+` e adicione `https://cotador.camaleao.cloud/mcp`. Conclua o login OAuth e confirme as ferramentas. Para a equipe, publique o plugin ou conexão no workspace conforme as permissões de administrador; cada pessoa deve entrar com sua própria conta do provedor. O e-mail do provedor pode ser diferente do e-mail da conta ChatGPT, salvo restrições de identidade do workspace.

O PDF da cotação continua salvo no servidor. O resultado MCP fornece apenas `cotacaoId`, nome do arquivo e indicador de disponibilidade. Para entregar o PDF no ChatGPT, implemente um download com autorização por usuário ou link temporário assinado; não anexe `API_SECRET_TOKEN` à URL. A rota REST de PDF existente continua com o contrato anterior para clientes já integrados.

## Verificação local

```bash
npm ci --ignore-scripts
node test_api.js
node test_mcp.js
node test_mcp_http.js
```

`npm test` também executa `test_parser.js`, que precisa de um fixture HTML em `raw_capture/` não incluído no repositório.
