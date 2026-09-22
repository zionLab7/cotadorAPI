# 🚀 Guia de Implantação 24h na VPS com Portainer, Docker e Traefik

Este guia ensina o passo a passo exato para colocar a **API de Cotação de Planos de Saúde** rodando em produção contínua (**24 horas por dia, 7 dias por semana**) no seu servidor VPS, aproveitando o ecossistema que você já tem: **Docker**, **Portainer** e **Traefik com SSL automático**.

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
4. Anote esse nome para usar no `docker-compose.yml`.

---

## 📦 Passo 2: Criar a Stack no Portainer

Você pode subir pelo **Web Editor** do Portainer ou conectando um repositório **Git**.

### Opção Recomendada: Criar Stack pelo Web Editor do Portainer

1. No Portainer, clique no menu lateral **Stacks** -> **Add stack**.
2. No campo **Name**, digite: `cotador-api`.
3. Na seção **Build method**, selecione **Web editor**.
4. Cole o conteúdo abaixo:

```yaml
version: '3.8'

services:
  cotador-api:
    image: ghcr.io/microsoft/playwright:v1.50.0-noble
    container_name: cotador-api
    restart: unless-stopped
    shm_size: '2gb' # Imprescindível para o Chromium headless não travar
    working_dir: /app
    environment:
      - PORT=3000
      - NODE_ENV=production
      - HEADLESS=true
      - STORAGE_STATE_PATH=/app/session_data/storage_state.json
      - PAINEL_USER=${PAINEL_USER}
      - PAINEL_PASSWORD=${PAINEL_PASSWORD}
      - PAINEL_URL=https://beta.paineldocorretor.com.br
    volumes:
      # Persiste a sessão de login para nunca deslogar ao reiniciar o container
      - cotador_session:/app/session_data
      # Persiste todos os PDFs gerados
      - cotador_pdfs:/app/public/pdfs
      # Mapeia os arquivos do projeto da sua VPS para dentro do container
      - /opt/cotador-api:/app
    command: sh -c "npm install --only=production && node src/server.js"
    networks:
      - traefik_public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.cotador.rule=Host(`${COTADOR_DOMAIN}`)"
      - "traefik.http.routers.cotador.entrypoints=websecure"
      - "traefik.http.routers.cotador.tls=true"
      - "traefik.http.routers.cotador.tls.certresolver=${TRAEFIK_CERTRESOLVER:-letsencrypt}"
      - "traefik.http.services.cotador.loadbalancer.server.port=3000"
      - "traefik.docker.network=traefik_public"

volumes:
  cotador_session:
    name: cotador_session_data
  cotador_pdfs:
    name: cotador_generated_pdfs

networks:
  traefik_public:
    external: true
```

> [!TIP]
> Se o nome da rede do seu Traefik for diferente de `traefik_public` (por exemplo, `proxy`), substitua `traefik_public` por `proxy` nas linhas `networks:` e `traefik.docker.network=proxy`.

---

## 🔑 Passo 3: Configurar as Variáveis de Ambiente no Portainer

Logo abaixo do editor da Stack no Portainer, há a seção **Environment variables**. Clique em **Add environment variable** e adicione:

| Nome da Variável | Valor de Exemplo | Descrição |
| :--- | :--- | :--- |
| `COTADOR_DOMAIN` | `cotador.suacorretora.com.br` | O subdomínio que você apontou no DNS |
| `PAINEL_USER` | `jefferson@allcc.com.br` | E-mail do corretor no Painel |
| `PAINEL_PASSWORD` | `sua_senha_do_painel` | Senha da sua conta |
| `TRAEFIK_CERTRESOLVER` | `letsencrypt` | Nome do resolver do seu Traefik (consulte o Traefik atual) |

---

## 📂 Passo 4: Copiar os Arquivos da API para a VPS

Para que o container execute seu código, copie a pasta deste projeto (`PuppetsCotador`) para a sua VPS em `/opt/cotador-api`.

### Via Terminal SSH do seu Mac:
Abra o terminal no Mac e envie os arquivos via `rsync` ou `scp`:
```bash
rsync -avz --exclude 'node_modules' --exclude 'raw_capture' --exclude '.git' \
  /Users/zionmac/Desktop/PuppetsCotador/ root@IP_DA_SUA_VPS:/opt/cotador-api/
```

Pronto! Os arquivos estarão na pasta `/opt/cotador-api` da sua VPS.

---

## 🚀 Passo 5: Fazer o Deploy da Stack

1. De volta ao Portainer, clique no botão azul **Deploy the stack**.
2. O Portainer baixará a imagem oficial do Playwright e iniciará o container.
3. Clique em **Containers** e veja o status do `cotador-api`:
   - Ele deve ficar verde com status **healthy** ou **running**.
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

## ✅ Passo 6: Validar se a API está Online na Internet

Abra o seu navegador ou terminal e acesse a URL com HTTPS:

### 1. Testar o Status
Acesse no navegador:
`https://cotador.suacorretora.com.br/api/status`

Deverá retornar:
```json
{
  "status": "online",
  "servico": "API Própria - Cotação de Planos de Saúde (Painel do Corretor)",
  "versao": "1.0.0",
  "totalPlanosCatalogo": 718
}
```

### 2. Testar o Catálogo
`https://cotador.suacorretora.com.br/api/operadoras`

### 3. Testar Cotação via cURL
```bash
curl -X POST https://cotador.suacorretora.com.br/api/cotacao \
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
   O Chromium usa `/dev/shm` para renderizar abas e capturar PDFs. O Docker por padrão limita isso a 64MB. A linha `shm_size: '2gb'` que colocamos no compose impede crashes de falta de memória para sempre.
2. **Sessão que Nunca Expira**:
   Como mapeamos o volume `cotador_session`, o arquivo `storage_state.json` fica salvo no disco físico da VPS. Se o servidor for reiniciado, o container volta autenticado instantaneamente.
3. **Reinicialização Automática (`restart: unless-stopped`)**:
   Se a VPS reiniciar por falta de energia ou manutenção do provedor, o Docker religará a sua API automaticamente assim que o sistema ligar.
4. **Monitoramento Fácil**:
   Pelo próprio aplicativo ou painel do Portainer no celular/computador, você pode ver o uso de CPU, Memória e Logs em tempo real de cada cotação solicitada pelos seus chatbots.
