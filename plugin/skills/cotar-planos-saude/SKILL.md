---
name: cotar-planos-saude
description: Consultar operadoras e planos ou gerar cotações de planos de saúde da All Cubo pelo servidor MCP all-cubo-cotador. Usar para pedidos de preços, comparação de planos e consultas ao catálogo.
---

# Cotar planos de saúde

Usar as ferramentas do servidor MCP `all-cubo-cotador` para obter dados atuais. Não inventar preços, redes credenciadas ou disponibilidade.

Antes de chamar `cotar_planos`, obter cidade e UF, modalidade (1 Individual/Familiar, 2 PME, 3 Adesão) e idade de cada beneficiário. Em caso de MEI ou CNPJ, considerar PME quando o pedido deixar isso claro. Confirmar ambiguidades relevantes. Operadoras são opcionais; omitir o filtro quando não houver preferência.

Agrupar as idades nas faixas `00-18`, `19-23`, `24-28`, `29-33`, `34-38`, `39-43`, `44-48`, `49-53`, `54-58`, `59+`. Por exemplo, 31, 32 e 47 anos tornam-se `[{"faixa":"29-33","quantidade":2},{"faixa":"44-48","quantidade":1}]`.

Consultar `listar_operadoras` quando for necessário conferir nomes aceitos. `consultar_catalogo` informa planos mapeados, mas não substitui uma cotação atual nem garante rede hospitalar. Mostrar operadora, plano, acomodação, coparticipação e valor total retornados por `cotar_planos`; esclarecer que o PDF é gerado no servidor e que o ID, por si só, não é um link de download.

Não solicitar nem mostrar tokens, credenciais, cookies, caminhos locais ou informações internas de autenticação. Se a ferramenta falhar, explicar que a cotação não foi concluída e não fornecer valores estimados como se fossem resultados do sistema.
