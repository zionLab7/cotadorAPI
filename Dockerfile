FROM mcr.microsoft.com/playwright:v1.50.0-noble

# Define diretório da aplicação
WORKDIR /app

# Copia manifestos e instala dependências de produção
COPY package*.json ./
RUN npm install --only=production

# Copia código fonte e catálogo de planos mapeados
COPY src ./src
COPY catalogo_planos_mapeados.json ./
COPY README.md ./

# Cria pasta de PDFs com permissões adequadas
RUN mkdir -p /app/public/pdfs

# Configurações de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production
ENV HEADLESS=true

# Expõe porta interna
EXPOSE 3000

# Healthcheck do container para o Portainer/Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/status').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Comando de inicialização
CMD ["node", "src/server.js"]
