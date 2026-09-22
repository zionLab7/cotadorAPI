# 📖 Documentação Completa da API de Cotação de Planos de Saúde

Esta API permite que sistemas externos (**Chatbots**, **WhatsApp / Evolution API**, **Typebot**, **CRMs**, **N8N / Make**) realizem cotações automáticas e consultem o catálogo de planos de saúde integrado ao **Painel do Corretor** (`beta.paineldocorretor.com.br`).

---

## 📌 Sumário
1. [Visão Geral e Arquitetura](#visão-geral-e-arquitetura)
2. [Regras de Negócio e Validações](#regras-de-negócio-e-validações)
3. [Autenticação e Gestão de Sessão](#autenticação-e-gestão-de-sessão)
4. [Referência dos Endpoints](#referência-dos-endpoints)
   - [GET /api/status](#1-get-apistatus)
   - [GET /api/operadoras](#2-get-apioperadoras)
   - [GET /api/catalogo](#3-get-apicatalogo)
   - [POST /api/cotacao](#4-post-apicotacao)
   - [GET /api/cotacao/:id/pdf](#5-get-apicotacaoidpdf)
   - [POST /api/auth/login](#6-post-apiauthlogin)
5. [Modelos de Dados (Schemas)](#modelos-de-dados-schemas)
6. [Exemplos Práticos de Integração](#exemplos-práticos-de-integração)
   - [cURL](#exemplo-curl)
   - [Node.js / Axios](#exemplo-nodejs--axios)
   - [Python / Requests](#exemplo-python)
   - [Typebot / Webhook](#exemplo-typebot--n8n)

---

## 1. Visão Geral e Arquitetura

A API atua como uma ponte inteligente entre os canais de atendimento da sua corretora e o Painel do Corretor.

```
[ Cliente no WhatsApp ]
          │
          ▼
[ Chatbot / Typebot / CRM ]
          │
          ▼  POST /api/cotacao
┌──────────────────────────────────────────────────────────┐
│              Sua API Própria (Node.js / VPS)             │
│                                                          │
│  1. Valida faixas etárias e cidade                      │
│  2. Reutiliza sessão ativa (storage_state.json)         │
│  3. Motor Playwright preenche o formulário em background │
│  4. Captura relatório consolidado de preços e hospitais  │
│  5. Renderiza e salva o PDF oficial da cotação          │
└──────────────────────────────────────────────────────────┘
          │
          ▼  JSON estruturado + Link do PDF
[ Chatbot envia valores em texto e anexa o PDF no WhatsApp ]
```

---

## 2. Regras de Negócio e Validações

### 2.1 Faixas Etárias Aceitas (Tabela ANS)
O cotador trabalha estritamente com as 10 faixas etárias padronizadas pela ANS:
| Faixa no JSON | Descrição | Índice Interno |
| :--- | :--- | :--- |
| `00-18` ou `0-18` | 0 a 18 anos | `vidas.0.quantidade` |
| `19-23` | 19 a 23 anos | `vidas.1.quantidade` |
| `24-28` | 24 a 28 anos | `vidas.2.quantidade` |
| `29-33` | 29 a 33 anos | `vidas.3.quantidade` |
| `34-38` | 34 a 38 anos | `vidas.4.quantidade` |
| `39-43` | 39 a 43 anos | `vidas.5.quantidade` |
| `44-48` | 44 a 48 anos | `vidas.6.quantidade` |
| `49-53` | 49 a 53 anos | `vidas.7.quantidade` |
| `54-58` | 54 a 58 anos | `vidas.8.quantidade` |
| `59+` ou `59` | 59 anos ou mais | `vidas.9.quantidade` |

> [!IMPORTANT]
> A requisição de cotação deve conter **pelo menos 1 vida** em qualquer uma das faixas com quantidade maior que zero.

### 2.2 Modalidades de Contratação
- `2`: **Saúde PME** (Pequenas e Médias Empresas - MEI / CNPJ a partir de 1 ou 2 vidas). *Padrão recomendado*.
- `1`: **Individual / Familiar** (Pessoa Física).
- `3`: **Adesão** (Coletivo por Adesão / Entidades de Classe).

### 2.3 Operadoras Homologadas
- `Amil` (id: 93)
- `Bradesco Seguros` (id: 3975)
- `Porto Seguro` (id: 30)
- `SulAmérica` / `Sulamérica` (id: 4)
- `Alice` (id: 4036)
- `Omint` (id: 28)

---

## 3. Autenticação e Segurança

A API conta com duas camadas de autenticação: a **segurança de acesso aos endpoints da sua API** (para proteger seu servidor) e a **gestão de sessão com o Painel do Corretor** (feita automaticamente pelo robô).

### 3.1 Token de Segurança da API (`API_SECRET_TOKEN`)

Para proteger sua API contra acessos indevidos e garantir que somente seus chatbots (WhatsApp / Typebot), CRMs e serviços autorizados façam requisições, configure a variável de ambiente `API_SECRET_TOKEN` no `.env` ou no Portainer.

Quando ativa, a API aceita a autenticação em **3 formatos flexíveis**:

1. **Header Authorization Bearer (Recomendado para CRMs e Código)**:
   ```http
   Authorization: Bearer SEU_TOKEN_SECRETO
   ```
2. **Header Customizado `x-api-key` (Recomendado para Webhooks e Gateways)**:
   ```http
   x-api-key: SEU_TOKEN_SECRETO
   ```
3. **Query Parameter `?token=` na URL (Ideal para links de PDF no WhatsApp)**:
   ```http
   https://cotador.suacorretora.com.br/api/cotacao/01a0c871-5895-7e0d-9816-ec733d9acf7e/pdf?token=SEU_TOKEN_SECRETO
   ```

#### Resposta de Erro para Token Ausente ou Inválido (`401 Unauthorized`):
```json
{
  "sucesso": false,
  "erro": "Acesso não autorizado. Token de API ausente ou inválido.",
  "ajuda": "Envie o cabeçalho \"Authorization: Bearer <SEU_TOKEN>\" ou \"x-api-key: <SEU_TOKEN>\" ou \"?token=<SEU_TOKEN>\""
}
```

> [!NOTE]
> O endpoint `GET /api/status` é **público**, permitindo que o Docker, Traefik, Portainer e serviços de monitoramento de uptime (como Uptime Kuma) validem a saúde da API sem necessidade de credenciais. Ele retorna o campo `"autenticacaoAtiva": true`.

---

### 3.2 Gestão de Sessão do Painel do Corretor

O robô gerencia a sessão no Painel do Corretor de forma **100% autônoma e transparente**:
1. **Sessão Persistente (`storage_state.json`)**:
   - Uma vez logado, todos os cookies e tokens do Painel do Corretor ficam salvos em disco.
   - Em cada nova cotação, o robô **não faz login do zero**: ele injeta os cookies salvos, acessa a cotação diretamente e conclui em segundos.
2. **Renovação Automática**:
   - Se o cookie expirar, o módulo `auth.js` detecta a expiração automaticamente, realiza o login com as credenciais do `.env` (`PAINEL_USER` e `PAINEL_PASSWORD`), salva o novo `storage_state.json` e prossegue com a cotação.
3. **Login Manual Forçado**:
   - Pode ser chamado a qualquer momento pelo endpoint `POST /api/auth/login`.

---

## 4. Referência dos Endpoints

---

### 1. `GET /api/status`
Verifica a saúde do serviço, integridade da sessão e quantidade de dados indexados.

#### Requisição
```http
GET /api/status HTTP/1.1
Host: localhost:3000
```

#### Resposta de Sucesso (`200 OK`)
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

### 2. `GET /api/operadoras`
Lista todas as operadoras cadastradas no catálogo, total de planos e linhas de produtos.

#### Requisição
```http
GET /api/operadoras HTTP/1.1
Host: localhost:3000
```

#### Resposta de Sucesso (`200 OK`)
```json
{
  "sucesso": true,
  "total": 6,
  "operadoras": [
    {
      "operadora": "Porto Seguro",
      "totalPlanos": 58,
      "linhas": ["Linha Pró", "Linha P | Com Mediservice", "Linha Tradicional | Com Mediservice"]
    },
    {
      "operadora": "Amil",
      "totalPlanos": 86,
      "linhas": ["Linha Amil", "Linha Selecionada Saúde", "Linha Black"]
    },
    {
      "operadora": "Bradesco Seguros",
      "totalPlanos": 144,
      "linhas": ["Nacional", "Nacional Plus", "Premium", "Efetivo"]
    }
  ]
}
```

---

### 3. `GET /api/catalogo`
Consulta e filtra todo o acervo de 718 opções de planos mapeados.

#### Parâmetros de URL (Query String)
| Parâmetro | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `operadora` | string | Filtro por nome da operadora | `Amil`, `Bradesco`, `Porto` |
| `acomodacao` | string | `Apartamento` ou `Enfermaria` | `Apartamento` |
| `coparticipacao` | boolean | `true` (com coparticipação) ou `false` (sem) | `false` |
| `mei` | boolean | `true` (aceita MEI) ou `false` | `true` |
| `busca` | string | Termo de busca livre | `Bronze`, `Platinum`, `Especial` |

#### Exemplo de Requisição
```http
GET /api/catalogo?operadora=Amil&acomodacao=Apartamento&coparticipacao=true HTTP/1.1
Host: localhost:3000
```

#### Resposta de Sucesso (`200 OK`)
```json
{
  "sucesso": true,
  "total": 62,
  "filtrosAplicados": {
    "operadora": "Amil",
    "acomodacao": "Apartamento",
    "coparticipacao": true
  },
  "planos": [
    {
      "key": "93-67980-88365-",
      "operadora": "Amil",
      "operadoraId": 93,
      "produto": "Amil Saúde - Interior I",
      "produtoId": 8798,
      "plano": "Bronze SP Mais",
      "planoId": 67980,
      "acomodacao": "Apartamento",
      "tabela": "Linha Amil",
      "tabelaId": 88365,
      "coparticipacao": true,
      "coparticipacaoTipo": "Parcial ",
      "mei": true,
      "qtdVidaMin": 5,
      "qtdVidaMax": 29
    }
  ]
}
```

---

### 4. `POST /api/cotacao`
Endpoint principal para disparar uma cotação completa no sistema. O robô preenche o formulário, seleciona os planos, extrai a tabela comparativa de preços, mapeia a rede credenciada e gera o PDF oficial.

#### Cabeçalhos
```http
Content-Type: application/json
```

#### Corpo da Requisição (JSON)
```json
{
  "titulo": "Cotação WhatsApp - Jefferson Souza",
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

#### Resposta de Sucesso (`200 OK`)
```json
{
  "sucesso": true,
  "cotacaoId": "01a0c871-5895-7e0d-9816-ec733d9acf7e",
  "titulo": "Cotação WhatsApp - Jefferson Souza",
  "corretor": {
    "nome": "Jefferson Souza",
    "email": "jefferson@allcc.com.br",
    "telefone": "(11) 95025-6952"
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
        {
          "faixa": "24 a 28",
          "quantidade": 1,
          "valorUnitario": 568.43,
          "valorTotalFaixa": 568.43
        },
        {
          "faixa": "29 a 33",
          "quantidade": 1,
          "valorUnitario": 650.76,
          "valorTotalFaixa": 650.76
        },
        {
          "faixa": "34 a 38",
          "quantidade": 1,
          "valorUnitario": 705.10,
          "valorTotalFaixa": 705.10
        },
        {
          "faixa": "49 a 53",
          "quantidade": 3,
          "valorUnitario": 936.42,
          "valorTotalFaixa": 2809.26
        },
        {
          "faixa": "54 a 58",
          "quantidade": 1,
          "valorUnitario": 1157.01,
          "valorTotalFaixa": 1157.01
        }
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
      "faixas": [
        {
          "faixa": "24 a 28",
          "quantidade": 1,
          "valorUnitario": 622.87,
          "valorTotalFaixa": 622.87
        }
      ]
    }
  ],
  "resumoHospitais": [
    {
      "hospital": "Hospitalis - Unid Barueri",
      "cidade": "Barueri",
      "cobertura": {
        "Prata Mais I": "H,M,PS",
        "Platinum R1": "-",
        "Nacional Plus 8": "H,M"
      }
    }
  ],
  "totalHospitaisMapeados": 940,
  "pdf": {
    "nomeArquivo": "cotacao-01a0c871-5895-7e0d-9816-ec733d9acf7e.pdf",
    "caminhoLocal": "/Users/zionmac/Desktop/PuppetsCotador/public/pdfs/cotacao-01a0c871-5895-7e0d-9816-ec733d9acf7e.pdf",
    "urlDownload": "/api/cotacao/01a0c871-5895-7e0d-9816-ec733d9acf7e/pdf"
  },
  "linkVisualizacaoWeb": "https://beta.paineldocorretor.com.br/cotacoes/01a0c871-5895-7e0d-9816-ec733d9acf7e/print",
  "geradoEm": "2026-09-22T09:47:00.000Z"
}
```

---

### 5. `GET /api/cotacao/:id/pdf`
Retorna o stream binário do arquivo PDF gerado para download ou anexo de mensagem.

#### Requisição
```http
GET /api/cotacao/01a0c871-5895-7e0d-9816-ec733d9acf7e/pdf HTTP/1.1
Host: localhost:3000
```

#### Cabeçalhos de Resposta
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="cotacao-01a0c871-5895-7e0d-9816-ec733d9acf7e.pdf"
```

---

### 6. `POST /api/auth/login`
Força a execução do login com e-mail e senha e regenera o `storage_state.json`.

#### Corpo da Requisição (Opcional se já configurado no `.env`)
```json
{
  "email": "seu_email@exemplo.com.br",
  "password": "sua_senha_secreta"
}
```

---

## 5. Exemplos Práticos de Integração

### Exemplo cURL
```bash
curl -X POST http://localhost:3000/api/cotacao \
  -H "Authorization: Bearer SEU_TOKEN_SECRETO" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Cotação Teste cURL",
    "cidade": "Guarulhos - SP",
    "modalidade": 2,
    "vidas": [
      { "faixa": "24-28", "quantidade": 2 },
      { "faixa": "39-43", "quantidade": 1 }
    ]
  }'
```

### Exemplo Node.js / Axios
```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const API_TOKEN = 'SEU_TOKEN_SECRETO';

async function solicitarCotacao() {
  const payload = {
    titulo: 'Cotação WhatsApp PME',
    cidade: 'São Paulo - SP',
    modalidade: 2,
    vidas: [
      { faixa: '29-33', quantidade: 2 },
      { faixa: '44-48', quantidade: 1 }
    ]
  };

  const response = await axios.post(`${API_URL}/api/cotacao`, payload, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`
    }
  });

  console.log('Cotação ID:', response.data.cotacaoId);
  console.log('Total Planos:', response.data.totalPlanos);
  
  // Link direto para download do PDF com o token anexado (para envio no WhatsApp)
  const pdfDownloadUrl = `${API_URL}${response.data.pdf.urlDownload}?token=${API_TOKEN}`;
  console.log('Baixar PDF em:', pdfDownloadUrl);
}

solicitarCotacao();
```

### Exemplo Python
```python
import requests

url = "http://localhost:3000/api/cotacao"
token = "SEU_TOKEN_SECRETO"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

payload = {
    "titulo": "Cotação Python API",
    "cidade": "Guarulhos - SP",
    "modalidade": 2,
    "vidas": [
        {"faixa": "24-28", "quantidade": 1},
        {"faixa": "49-53", "quantidade": 2}
    ]
}

res = requests.post(url, json=payload, headers=headers)
data = res.json()

for plano in data.get("planos", []):
    print(f"{plano['operadora']} - {plano['plano']}: R$ {plano['valorTotal']:.2f}")

pdf_url = f"http://localhost:3000{data['pdf']['urlDownload']}?token={token}"
print("PDF pronto:", pdf_url)
```

### Exemplo Typebot / N8N
1. No Typebot / N8N, crie um nó do tipo **Webhook / HTTP Request**:
   - **Method**: `POST`
   - **URL**: `https://cotador.seudominio.com.br/api/cotacao`
   - **Headers**:
     - `Authorization`: `Bearer SEU_TOKEN_SECRETO`
     - `Content-Type`: `application/json`
   - **Body**:
     ```json
     {
       "titulo": "Cliente {{nome_cliente}}",
       "cidade": "{{cidade_cliente}}",
       "modalidade": 2,
       "vidas": [
         { "faixa": "24-28", "quantidade": {{qtd_vidas_24_28}} }
       ]
     }
     ```
2. Salve a resposta nas variáveis do Typebot:
   - `resultado = response.planos`
   - `pdf_url = "https://cotador.seudominio.com.br" + response.pdf.urlDownload + "?token=SEU_TOKEN_SECRETO"`
3. Envie a mensagem de texto com os valores e, em seguida, anexe o link ou o arquivo PDF direto para o lead no WhatsApp!

