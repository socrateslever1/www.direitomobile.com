# DireitoMobile V2 — interface experimental

Interface responsiva mobile-first sem framework e sem dependências externas, criada em `direitomobile-v2/index.html` na branch `direitomobile-v2-interface-20261025`.

## Objetivo
Substituir a interface legada DireitoHD por uma experiência própria de pesquisa e leitura, mantendo o **repositório separado** `socrateslever1/leis` como fonte de documentos Markdown. A página está isolada, não altera a produção.

## Recursos da primeira entrega
- Pesquisa local no catálogo inicial de normas.
- Leitor de Markdown sob demanda a partir do repositório leis, com fonte redimensionável e modo escuro.
- Atalho para artigo, favoritos locais, categorias e layout adaptativo.
- Links externos do conteúdo abertos em nova aba, sem executar HTML de Markdown.

## Limitações e próximos passos
- O catálogo inicial contém apenas Constituição Federal e duas leis federais; **não** implementa pesquisa em todos os documentos nem pesquisa textual dentro dos artigos.
- Repositório `leis` é de grande porte; nunca empacotar tudo no frontend. Criar um processo de ingestão incremental (GitHub Actions ou serviço externo), tabela normalizada de documentos/artigos e índice de busca paginado (Cloudflare D1 FTS5, por exemplo).
- Carregamento atual depende de acesso online a `raw.githubusercontent.com`, portanto offline/PWA ainda não está implementado.
- Confirmar caminhos reais e integridade das leis antes de ampliar catálogo.
- Conferir vigência/consolidação com fontes oficiais; cópias não substituem os portais oficiais.
- Antes de publicar em Cloudflare Pages, configurar raiz de deploy `direitomobile-v2/` ou extrair esta pasta para um projeto isolado; não mesclar diretamente em `main` esperando que a aplicação vire a página principal.
- Implementar sumário de títulos/capítulos, pesquisa no documento, destaques, notas e API de busca completa em etapas testadas.

## Fonte
Acervo: https://github.com/socrateslever1/leis
