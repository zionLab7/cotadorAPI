const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const START_URL = process.argv[2] || 'https://paineldocorretor.com.br';

const OUTPUT_DIR = __dirname;
const HAR_PATH = path.join(OUTPUT_DIR, 'session_traffic.har');
const APIS_PATH = path.join(OUTPUT_DIR, 'captured_apis.json');
const ACTIONS_PATH = path.join(OUTPUT_DIR, 'captured_actions.json');

const capturedAPIs = [];
const capturedActions = [];

function getCssSelector(el) {
  if (!el) return '';
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      path.unshift(selector);
      break;
    } else {
      let sibling = el;
      let nth = 1;
      while (sibling = sibling.previousElementSibling) {
        if (sibling.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(' > ');
}

(async () => {
  console.log('=====================================================');
  console.log('🚀 INICIANDO GRAVADOR DO COTADOR');
  console.log('=====================================================');
  console.log(`URL Inicial: ${START_URL}`);
  console.log('Abriremos o Google Chrome para você fazer a cotação.');
  console.log('Tudo que você clicar, preencher e todas as requisições');
  console.log('de rede (APIs, tokens, preços) serão gravadas.');
  console.log('Quando terminar a cotação, basta FECHAR a janela do Chrome.');
  console.log('=====================================================\n');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    recordHar: {
      path: HAR_PATH,
      mode: 'full',
      content: 'attach'
    }
  });

  // Expose action logger to browser window
  await context.exposeBinding('__recordAction', (source, action) => {
    action.timestamp = new Date().toISOString();
    capturedActions.push(action);
    console.log(`\x1b[36m[AÇÃO DO USUÁRIO]\x1b[0m ${action.type.toUpperCase()}: ${action.description}`);
  });

  // Inject action listener on all pages
  await context.addInitScript(() => {
    function describeElement(el) {
      if (!el) return 'elemento desconhecido';
      const tag = el.tagName.toLowerCase();
      const text = (el.innerText || el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' ');
      const name = el.getAttribute('name');
      const placeholder = el.getAttribute('placeholder');
      const aria = el.getAttribute('aria-label');
      const id = el.id ? `#${el.id}` : '';
      const type = el.getAttribute('type');

      let desc = `<${tag}${type ? ` type="${type}"` : ''}${id}>`;
      if (name) desc += ` [name="${name}"]`;
      if (placeholder) desc += ` [placeholder="${placeholder}"]`;
      if (aria) desc += ` [aria="${aria}"]`;
      if (text) desc += ` "${text}"`;
      return desc;
    }

    function getSelector(el) {
      if (!el) return '';
      if (el.id) return `#${el.id}`;
      let parts = [];
      let current = el;
      while (current && current.nodeType === 1) {
        let tag = current.tagName.toLowerCase();
        if (current.id) {
          parts.unshift(`#${current.id}`);
          break;
        }
        let sibling = current;
        let nth = 1;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.tagName.toLowerCase() === tag) nth++;
        }
        parts.unshift(nth > 1 ? `${tag}:nth-of-type(${nth})` : tag);
        current = current.parentElement;
      }
      return parts.join(' > ');
    }

    window.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, input, select, [role="button"], label, tr, li') || e.target;
      if (window.__recordAction) {
        window.__recordAction({
          type: 'click',
          targetTag: target.tagName,
          description: describeElement(target),
          selector: getSelector(target),
          value: target.value || null
        }).catch(() => {});
      }
    }, true);

    window.addEventListener('change', (e) => {
      const target = e.target;
      if (window.__recordAction) {
        window.__recordAction({
          type: 'change/input',
          targetTag: target.tagName,
          description: describeElement(target),
          selector: getSelector(target),
          value: target.type === 'password' ? '********' : target.value
        }).catch(() => {});
      }
    }, true);
  });

  // Track Network Requests / Responses (APIs)
  context.on('response', async (response) => {
    try {
      const request = response.request();
      const resourceType = request.resourceType();
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';

      // We are primarily interested in fetch, xhr, and json responses
      const isApi = resourceType === 'fetch' || resourceType === 'xhr' || contentType.includes('application/json');

      if (isApi) {
        let responseBody = null;
        let isJson = false;

        try {
          const text = await response.text();
          try {
            responseBody = JSON.parse(text);
            isJson = true;
          } catch {
            responseBody = text.slice(0, 1000); // keep text preview
          }
        } catch (e) {
          responseBody = `[Não foi possível ler o corpo da resposta: ${e.message}]`;
        }

        let postData = null;
        try {
          const rawPost = request.postData();
          if (rawPost) {
            try {
              postData = JSON.parse(rawPost);
            } catch {
              postData = rawPost;
            }
          }
        } catch {}

        const entry = {
          timestamp: new Date().toISOString(),
          method: request.method(),
          url: url,
          status: status,
          resourceType: resourceType,
          headers: request.headers(),
          postData: postData,
          responseHeaders: response.headers(),
          responseBody: responseBody
        };

        capturedAPIs.push(entry);

        // Highlight in terminal
        const methodColor = request.method() === 'POST' ? '\x1b[32m' : request.method() === 'GET' ? '\x1b[34m' : '\x1b[33m';
        const statusColor = status >= 200 && status < 300 ? '\x1b[32m' : '\x1b[31m';
        console.log(`${methodColor}[API ${request.method()}]\x1b[0m ${statusColor}${status}\x1b[0m ${url.slice(0, 100)}`);
      }
    } catch (err) {
      // ignore transient network errors
    }
  });

  const page = await context.newPage();
  console.log(`\nNavegando para: ${START_URL}`);
  try {
    await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    console.log(`Nota na navegação: ${err.message}`);
  }

  console.log('\n=====================================================');
  console.log('👉 NAVEGADOR PRONTO!');
  console.log('Faça o login e realize a cotação no navegador que abriu.');
  console.log('Quando terminar, simplesmente feche a janela do Chrome.');
  console.log('=====================================================\n');

  // Wait for browser close
  await new Promise((resolve) => {
    browser.on('disconnected', () => {
      console.log('\nNavegador fechado pelo usuário. Finalizando gravação...');
      resolve();
    });
  });

  // Save captured data
  fs.writeFileSync(APIS_PATH, JSON.stringify(capturedAPIs, null, 2), 'utf-8');
  fs.writeFileSync(ACTIONS_PATH, JSON.stringify(capturedActions, null, 2), 'utf-8');

  console.log('\n=====================================================');
  console.log('✅ GRAVAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log(`- Tráfego total salvo em: session_traffic.har`);
  console.log(`- Requisições de API interceptadas: ${capturedAPIs.length} salvas em captured_apis.json`);
  console.log(`- Ações de usuário capturadas: ${capturedActions.length} salvas em captured_actions.json`);
  console.log('=====================================================\n');
})();
