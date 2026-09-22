/**
 * Script de Teste Ponta a Ponta (E2E)
 * Executa uma cotação real, testa a seleção de planos e a geração de PDF
 */

const { executarCotacao } = require('./src/cotador');
require('dotenv').config();

(async () => {
  console.log('=====================================================');
  console.log('🧪 INICIANDO TESTE PONTA A PONTA (E2E) DA COTAÇÃO');
  console.log('=====================================================');

  const payload = {
    titulo: `Teste E2E - ${new Date().toLocaleTimeString('pt-BR')}`,
    cidade: 'Guarulhos - SP',
    modalidade: 2,
    vidas: [
      { faixa: '24-28', quantidade: 1 },
      { faixa: '34-38', quantidade: 1 }
    ],
    operadoras: ['Porto Seguro', 'Amil']
  };

  try {
    const resultado = await executarCotacao(payload);
    console.log('\n=====================================================');
    console.log('🎉 RESULTADO DA COTAÇÃO:');
    console.log('ID:', resultado.cotacaoId);
    console.log('Título:', resultado.titulo);
    console.log('Total de Planos:', resultado.totalPlanos);
    console.log('PDF Gerado:', resultado.pdf.nomeArquivo);
    console.log('Caminho PDF:', resultado.pdf.caminhoLocal);
    console.log('URL Download:', resultado.pdf.urlDownload);
    console.log('=====================================================');
  } catch (err) {
    console.error('\n❌ ERRO NO TESTE E2E:', err.message);
    process.exit(1);
  }
})();
