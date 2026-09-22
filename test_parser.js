const fs = require('fs');
const path = require('path');
const { parseQuotationHtml } = require('./src/parser');

const sampleHtmlPath = path.join(__dirname, 'raw_capture', '6a3c3f9a596f0fbc97149ba5bf2e9b495b5ffef8.html');

if (!fs.existsSync(sampleHtmlPath)) {
  console.error('Arquivo de teste não encontrado:', sampleHtmlPath);
  process.exit(1);
}

const html = fs.readFileSync(sampleHtmlPath, 'utf-8');
const result = parseQuotationHtml(html);

console.log('=== TESTE DO PARSER ===');
console.log('Título:', result.titulo);
console.log('Corretor:', result.corretor);
console.log('Total de Planos extraídos:', result.totalPlanos);
console.log('Total de Hospitais mapeados:', result.totalHospitaisMapeados);

console.log('\n--- PLANOS EXTRAÍDOS ---');
result.planos.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.operadora}] ${p.plano} - ${p.acomodacao} (${p.coparticipacao}): R$ ${p.valorTotal.toFixed(2)}`);
  console.log(`   Faixas de idade (${p.faixas.length}):`);
  p.faixas.forEach(f => {
    console.log(`     - ${f.faixa} (${f.quantidade}x): R$ ${f.valorUnitario.toFixed(2)} = R$ ${f.valorTotalFaixa.toFixed(2)}`);
  });
});

console.log('\n--- PRIMEIROS 3 HOSPITAIS ---');
console.log(JSON.stringify(result.hospitais.slice(0, 3), null, 2));

if (result.totalPlanos === 8 && result.planos[0].valorTotal > 0) {
  console.log('\n✅ TESTE DO PARSER APROVADO COM 100% DE SUCESSO!');
} else {
  console.error('\n❌ Falha no teste do parser');
  process.exit(1);
}
