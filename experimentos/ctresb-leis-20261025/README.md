# Laboratório ctresb/leis (2026-10-25)

Prova de conceito **isolada em branch**, sem substituir arquivos de produção.

Origem dos exemplos: https://github.com/ctresb/leis . Créditos: João Davi e contribuidores; preservar MIT para código reutilizado. Textos normativos são reproduções de atos oficiais, mas podem conter erros de OCR ou defasagem.

## Estratégia
- Legislação de origem em Markdown com metadados YAML.
- Índice pequeno (`indice.json`) para filtragem rápida por nome, número e ementa.
- Busca em navegador com normalização de acentos, sem dependência de framework.
- Textos carregados por demanda ao clicar no resultado (sem carregar todas as normas).
- Renderizador textual seguro (não interpreta HTML arbitrário de Markdown).
- Controle de tamanho da fonte e modo de contraste. Verificação de vigência deve ocorrer na fonte oficial.

## Limitações
A amostra contém dois arquivos federais reais; **não** corresponde à importação integral do acervo (>323 mil normas, vários GB). O formato Markdown, isoladamente, não torna uma busca de texto integral rápida: é necessário índice invertido ou FTS5/Postgres em um backend para escalar. A filtragem desta prova de conceito cobre apenas metadados, não o corpo de todas as normas. Nenhum benchmark de desempenho foi executado ainda. Em testes avançados, considerar índice pré-gerado dividido por jurisdição, pesquisa por artigo e ranking, atualização incremental e cache offline seletivo.

## Como testar
Abra `index.html` em um servidor HTTP estático (ou por GitHub Pages/Cloudflare Pages), nunca pelo esquema file://. Pesquise por `10401`, `drummond` ou `gratificação`, abra a norma, confira a fonte, ajuste a fonte e contraste. Quando o comportamento estiver validado, expandir o corpus por importador separado. Não modificar a branch `main` sem revisão.
