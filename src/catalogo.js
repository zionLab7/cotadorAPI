/**
 * Módulo de Catálogo de Planos e Operadoras
 * Gerencia a consulta de todas as opções de planos mapeadas
 */

const fs = require('fs');
const config = require('./config');

let catalogoCache = null;

function carregarCatalogo() {
  if (catalogoCache) return catalogoCache;
  if (fs.existsSync(config.CATALOGO_PATH)) {
    try {
      catalogoCache = JSON.parse(fs.readFileSync(config.CATALOGO_PATH, 'utf-8'));
      return catalogoCache;
    } catch (e) {
      console.error('Erro ao ler catalogo_planos_mapeados.json:', e.message);
    }
  }
  return {};
}

function listarOperadoras() {
  const cat = carregarCatalogo();
  return Object.keys(cat).map(op => ({
    operadora: op,
    totalPlanos: cat[op].length,
    linhas: [...new Set(cat[op].map(p => p.tabela))].filter(Boolean)
  }));
}

function consultarPlanos(filtros = {}) {
  const cat = carregarCatalogo();
  let resultados = [];

  const {
    operadora,
    acomodacao,
    coparticipacao,
    mei,
    busca
  } = filtros;

  for (const [opNome, planos] of Object.entries(cat)) {
    if (operadora && !opNome.toLowerCase().includes(operadora.toLowerCase())) {
      continue;
    }

    planos.forEach(p => {
      if (acomodacao && p.acomodacao.toLowerCase() !== acomodacao.toLowerCase()) {
        return;
      }
      if (typeof coparticipacao === 'boolean' && p.coparticipacao !== coparticipacao) {
        return;
      }
      if (typeof mei === 'boolean' && p.mei !== mei) {
        return;
      }
      if (busca) {
        const termo = busca.toLowerCase();
        const texto = `${p.operadora} ${p.plano} ${p.produto} ${p.tabela}`.toLowerCase();
        if (!texto.includes(termo)) return;
      }

      resultados.push(p);
    });
  }

  return resultados;
}

module.exports = {
  carregarCatalogo,
  listarOperadoras,
  consultarPlanos
};
