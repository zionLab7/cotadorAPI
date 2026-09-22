# 🚀 Guia de Implantação 24h na VPS com Portainer, Docker e Traefik

Este guia ensina o passo a passo exato para colocar a **API de Cotação de Planos de Saúde** rodando em produção contínua (**24 horas por dia, 7 dias por semana**) no seu servidor VPS, aproveitando o ecossistema que você já tem: **Docker**, **Portainer**, **Git** e **Traefik com SSL automático**.

Repositório Oficial do Projeto: `https://github.com/zionLab7/cotadorAPI`

---

## 📋 Pré-requisitos

1. **Servidor VPS** com Docker e Portainer ativos.
2. **Traefik** já configurado com proxy reverso e emissão de SSL (Let's Encrypt).
3. **Apontamento de DNS (Tipo A)**:
   - Crie um subdomínio no seu provedor de DNS (ex: Cloudflare, Hostinger, Registro.br):
     - **Nome**: `cotador` (ex: `cotador.suacorretora.com.br`)
     - **Tipo**: `A`
     - **Destino / IP**: IP da sua VPS
     - *(Se usar Cloudflare, deixe a nuvem cinza `DNS Only` temporariamente para emitir o certificado Let's Encrypt do Traefik de primeira)*.

---

## 🛠️ Passo 1: Identificar o Nome da Rede do seu Traefik

O Traefik precisa estar na mesma rede Docker do container da API para rotear o tráfego.
1. Abra o **Portainer**.
2. Vá no menu lateral em **Networks**.
3. Procure a rede onde o seu container do Traefik está conectado.
   - Nomes mais comuns: `traefik_public`, `proxy`, `traefik-net`, `web`, `traefik_default`.
4. Anote esse nome para usar na configuração (o padrão pré-configurado é `traefik_public`).

---

## 📦 Passo 2: Criar a Stack no Portainer

Você pode subir diretamente pelo repositório GitHub (opção mais rápida e limpa):

### Método Recomendado: Direto pelo Repositório GitHub

1. No Portainer, clique no menu lateral **Stacks** -> **Add stack**.
2. No campo **Name**, digite: `cotador-api`.
3. Na seção **Build method**, clique em **Repository**.
4. Preencha os campos do Git:
   - **Repository URL**: `https://github.com/zionLab7/cotadorAPI`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.yml`
   - **Automatic updates**: Ative se quiser que o Portainer atualize o container a cada novo commit (polling ou webhook).

---

## 🔑 Passo 3: Configurar as Variáveis de Ambiente no Portainer

Abaixo das configurações do repositório, localize a seção **Environment variables**. Clique em **Add environment variable** para cada uma das variáveis:

| Nome da Variável | Valor de Exemplo | Descrição |
| :--- | :--- | :--- |
| `COTADOR_DOMAIN` | `cotador.suacorretora.com.br` | O subdomínio que você apontou no DNS |
| `PAINEL_USER` | `jefferson@allcc.com.br` | E-mail da conta no Painel do Corretor |
| `PAINEL_PASSWORD` | `sua_senha_do_painel` | Senha da conta no Painel do Corretor |
| `API_SECRET_TOKEN` | `sua_chave_secreta_aqui_123` | **Token de autenticação para proteger sua API contra acessos indevidos** |
| `TRAEFIK_CERTRESOLVER` | `letsencrypt` | Nome do resolver SSL do seu Traefik |

> [!TIP]
> Gere um token forte para o `API_SECRET_TOKEN` (ex: `cotador_sec_99f2b84a91`). Você usará esse token nos headers do seu Typebot, CRM ou N8N.

---

## 🚀 Passo 4: Fazer o Deploy da Stack

1. Clique no botão azul **Deploy the stack**.
2. O Portainer clonará o repositório, construirá a imagem Docker com o Playwright e o Chromium headless, e inicializará o container.
3. Clique em **Containers** e veja o status do `cotador-api`:
   - Ele deve ficar verde com status **running**.
4. Clique no ícone de **Logs** para acompanhar a inicialização:
   ```text
   =====================================================
   🚀 API DE COTAÇÃO DE PLANOS DE SAÚDE PRONTA!
   📡 Ouvindo em: http://localhost:3000
   - Status:     GET  http://localhost:3000/api/status
   - Operadoras: GET  http://localhost:3000/api/operadoras
   - Catálogo:   GET  http://localhost:3000/api/catalogo
   - Cotar:      POST http://localhost:3000/api/cotacao
   - Baixar PDF: GET  http://localhost:3000/api/cotacao/:id/pdf
   =====================================================
   ```

---

## ✅ Passo 5: Validar se a API está Online e Protegida

Abra o seu terminal ou Postman e teste os endpoints na URL com HTTPS:

### 1. Testar o Status (Endpoint Público)
Acesse no navegador:
`https://cotador.suacorretora.com.br/api/status`

Deverá retornar:
```json
{
  "status": "online",
  "servico": "API Própria - Cotação de Planos de Saúde (Painel do Corretor)",
  "versao": "1.0.0",
  "autenticacaoAtiva": true,
  "sessaoAtiva": true,
  "totalOperadorasCatalogo": 6,
  "totalPlanosCatalogo": 718
}
```

### 2. Testar Bloqueio Sem Token (Retorna 401)
```bash
curl -i https://cotador.suacorretora.com.br/api/operadoras
# Retorno esperado: HTTP/1.1 401 Unauthorized
```

### 3. Testar Acesso Autorizado com Token
```bash
curl -H "Authorization: Bearer sua_chave_secreta_aqui_123" \
  https://cotador.suacorretora.com.br/api/operadoras
# Retorno esperado: HTTP/1.1 200 OK com a lista das 6 operadoras
```

### 4. Testar Cotação Automatizada via cURL
```bash
curl -X POST https://cotador.suacorretora.com.br/api/cotacao \
  -H "Authorization: Bearer sua_chave_secreta_aqui_123" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Teste VPS 24h",
    "cidade": "Guarulhos - SP",
    "modalidade": 2,
    "vidas": [
      { "faixa": "24-28", "quantidade": 1 },
      { "faixa": "34-38", "quantidade": 1 }
    ]
  }'
```

---

## 🛡️ Dicas de Ouro para Operação 24/7

1. **Memória Compartilhada (`shm_size: '2gb'`)**:
   O Chromium usa `/dev/shm` para renderizar abas e capturar PDFs. O Docker por padrão limita isso a 64MB. A linha `shm_size: '2gb'` que colocamos no compose impede crashes de falta de memória.
2. **Sessão que Nunca Expira**:
   Como mapeamos o volume `cotador_session`, o arquivo `storage_state.json` fica salvo no volume Docker físico da VPS. Se o servidor for reiniciado, o container volta autenticado instantaneamente.
3. **Renovação Automática**:
   Se a sessão eventualmente expirar após dias inativa, a API usa o login e senha configurados para refazer o login sozinha sem interrupção no serviço.
4. **Reinicialização Automática (`restart: unless-stopped`)**:
   Se a VPS reiniciar por manutenção ou falta de energia, o Docker religará a sua API automaticamente.
5. **Integração com Typebot / WhatsApp**:
   Ao enviar o link do PDF gerado para o cliente no WhatsApp, anexe o token como parâmetro:
   `https://cotador.suacorretora.com.br/api/cotacao/ID_COTACAO/pdf?token=sua_chave_secreta_aqui_123`
