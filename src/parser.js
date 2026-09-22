/**
 * Parser de Relatório Comparativo de Cotação
 * Extrai dados estruturados a partir do HTML consolidado do Painel do Corretor (/print)
 */

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getCellData(cellHtml) {
  if (!cellHtml) return '';
  
  // Se contiver múltiplos spans/divs/ps, preserva cada fragmento
  const spans = cellHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/gi);
  if (spans && spans.length >= 2) {
    const parts = spans.map(s => cleanText(s)).filter(Boolean);
    if (parts.length >= 2) return parts;
  }

  const divs = cellHtml.match(/<div[^>]*>([\s\S]*?)<\/div>/gi);
  if (divs && divs.length >= 2) {
    const parts = divs.map(d => cleanText(d)).filter(Boolean);
    if (parts.length >= 2) return parts;
  }

  const ps = cellHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  if (ps && ps.length >= 2) {
    const parts = ps.map(p => cleanText(p)).filter(Boolean);
    if (parts.length >= 2) return parts;
  }

  return cleanText(cellHtml);
}

function parseQuotationHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') return null;

  const tables = htmlContent.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
  if (tables.length === 0) return null;

  // 1. Título da cotação
  const titleMatch = htmlContent.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
  const titulo = titleMatch ? cleanText(titleMatch[1]) : 'Cotação';

  // Helper para fatiar linhas e células
  function getRows(tableHtml) {
    const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    return rows.map(r => {
      const cells = r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      return cells.map(c => getCellData(c));
    });
  }

  // 2. Tabela 0: Tabela Comparativa de Preços e Vidas
  const t0Rows = getRows(tables[0]);

  // Informações do Corretor
  let corretor = { nome: '', email: '', telefone: '' };
  if (t0Rows[1] && t0Rows[1][0]) {
    const infoText = Array.isArray(t0Rows[1][0]) ? t0Rows[1][0].join(' ') : String(t0Rows[1][0]);
    const nameM = infoText.match(/Corretor\s*([^\n\r]+?)(?=E-mail|$)/i);
    const emailM = infoText.match(/E-mail\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const telM = infoText.match(/Telefone\s*([\(\)\d\s-]+)/i);
    corretor = {
      nome: nameM ? nameM[1].replace(/E-mail.*/, '').trim() : '',
      email: emailM ? emailM[1].trim() : '',
      telefone: telM ? telM[1].trim() : ''
    };
  }

  // Identificação das colunas de planos (Linha 2)
  const planHeaders = t0Rows[2] || [];
  const planos = [];

  for (let col = 1; col < planHeaders.length; col++) {
    const cell = planHeaders[col];
    let planoNome = '';
    let operadoraNome = '';

    if (Array.isArray(cell)) {
      planoNome = cell[0] || '';
      operadoraNome = cell[1] || '';
    } else if (typeof cell === 'string') {
      const ops = [
        'Alice', 'Amil', 'Bradesco Seguros', 'Omint', 'Porto Seguro',
        'Sulamérica', 'SulAmérica', 'Unimed', 'Notredame Intermédica',
        'GNDI', 'Seguros Unimed', 'Hapvida', 'Prevent Senior'
      ];
      let foundOp = '';
      for (const op of ops) {
        if (cell.endsWith(op)) {
          foundOp = op;
          planoNome = cell.slice(0, cell.length - op.length).trim();
          operadoraNome = op;
          break;
        }
      }
      if (!foundOp) {
        planoNome = cell;
      }
    }

    const modalidade = (t0Rows[3] && t0Rows[3][col]) || '';
    const acomodacao = (t0Rows[4] && t0Rows[4][col]) || '';
    const coparticipacao = (t0Rows[5] && t0Rows[5][col]) || '';

    // Detalhamento de valores por faixa etária
    const faixas = [];
    for (let r = 6; r < t0Rows.length - 1; r++) {
      const row = t0Rows[r];
      const cell0 = row[0];
      let faixa = '';
      let quantidade = 1;

      if (Array.isArray(cell0)) {
        faixa = cell0[0] || '';
        const qtdMatch = (cell0[1] || '').match(/(\d+)/);
        quantidade = qtdMatch ? parseInt(qtdMatch[1], 10) : 1;
      } else {
        const str = String(cell0 || '');
        const matchFaixa = str.match(/(\d+\s*a\s*\d+|\d+\+)/i);
        const matchQtd = str.match(/(\d+)\s*x/i);
        faixa = matchFaixa ? matchFaixa[1].replace(/\s+/g, ' ') : str;
        quantidade = matchQtd ? parseInt(matchQtd[1], 10) : 1;
      }

      const priceStr = String(row[col] || '');
      const precoUnit = parseFloat(priceStr.replace(/\./g, '').replace(',', '.')) || 0;

      faixas.push({
        faixa: faixa,
        quantidade: quantidade,
        valorUnitario: precoUnit,
        valorTotalFaixa: Math.round(precoUnit * quantidade * 100) / 100
      });
    }

    // Linha final com o valor total
    const totalRow = t0Rows[t0Rows.length - 1];
    const totalStr = String(totalRow[col] || '');
    const valorTotal = parseFloat(totalStr.replace(/\./g, '').replace(',', '.')) || 0;

    planos.push({
      idColuna: col,
      plano: planoNome,
      operadora: operadoraNome,
      modalidade: Array.isArray(modalidade) ? modalidade.join(' ') : modalidade,
      acomodacao: Array.isArray(acomodacao) ? acomodacao.join(' ') : acomodacao,
      coparticipacao: Array.isArray(coparticipacao) ? coparticipacao.join(' ') : coparticipacao,
      valorTotal: valorTotal,
      faixas: faixas
    });
  }

  // 3. Tabela 1: Rede Credenciada (Hospitais e Laboratórios)
  const hospitais = [];
  if (tables[1]) {
    const t1Rows = getRows(tables[1]);
    for (let r = 3; r < t1Rows.length; r++) {
      const row = t1Rows[r];
      if (row.length >= 2 && row[0]) {
        let hospitalNome = '';
        let cidade = '';

        if (Array.isArray(row[0])) {
          hospitalNome = row[0][0] || '';
          cidade = row[0][1] || '';
        } else {
          hospitalNome = String(row[0]);
          cidade = String(row[1] || '');
        }

        const coberturaPorPlano = {};
        for (let col = 1; col < planHeaders.length; col++) {
          const rawCob = row[col];
          const cobertura = Array.isArray(rawCob) ? rawCob.join(', ') : String(rawCob || '-');
          const planoKey = planos[col - 1]?.plano || `Plano ${col}`;
          coberturaPorPlano[planoKey] = cobertura;
        }

        if (hospitalNome && hospitalNome !== '-' && hospitalNome !== 'Principais hospitais e laboratórios') {
          hospitais.push({
            hospital: hospitalNome,
            cidade: cidade,
            cobertura: coberturaPorPlano
          });
        }
      }
    }
  }

  return {
    titulo,
    corretor,
    totalPlanos: planos.length,
    planos,
    totalHospitaisMapeados: hospitais.length,
    hospitais: hospitais
  };
}

module.exports = { parseQuotationHtml };
