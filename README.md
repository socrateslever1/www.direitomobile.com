# Direito Mobile

Portal jurídico em reconstrução a partir do acervo legado do Direito HD.

## Recursos do primeiro marco

- catálogo gerado automaticamente a partir de `mapadosite.html`;
- biblioteca com pesquisa e filtros por tipo e área;
- leitor modular por dispositivo;
- painéis separados de explicação, comentários, relações e IA;
- régua interna de leitura ativável;
- navegação transversal por tema, com `Feminicídio` como primeiro conjunto validado;
- endpoint de comentários preparado para Cloudflare D1;
- arquitetura compatível com Cloudflare Pages.

## Desenvolvimento

```bash
npm install
npm run dev
```

O catálogo é reconstruído em todo build:

```bash
npm run catalog
npm run build
npm test
```

## Cloudflare Pages

- comando de build: `npm run build`
- diretório de saída: `dist`
- versão do Node.js: 22 ou superior

Para comentários compartilhados, crie um banco D1, aplique `migrations/0001_comments.sql` e vincule-o ao projeto Pages com o nome `DB`. Não coloque identificadores de produção nem segredos diretamente no código.

## Estado do acervo

O catálogo não equivale a uma certificação de vigência. Os textos legados ainda serão extraídos do código Wix, comparados com fontes governamentais e versionados antes de receberem o selo de conferência oficial.
