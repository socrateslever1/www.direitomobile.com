import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, BookOpen, Bot, CheckCircle2, ChevronRight, CircleHelp, FileText,
  Filter, Highlighter, Landmark, Library, Link2, Menu, MessageSquare, Moon,
  Search, Settings2, Sparkles, Sun, Tags, TextSearch, X,
} from 'lucide-react'
import catalog from './data/catalog.generated.json'
import { featuredDocuments, legalTopics } from './data/featured.js'

const normalized = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function App() {
  const [section, setSection] = useState('inicio')
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('Todas')
  const [type, setType] = useState('Todos')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('dm-theme') === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('dm-theme', dark ? 'dark' : 'light')
  }, [dark])

  const areas = useMemo(() => ['Todas', ...new Set(catalog.map((item) => item.area))], [])
  const types = useMemo(() => ['Todos', ...new Set(catalog.map((item) => item.type))], [])
  const filtered = useMemo(() => {
    const term = normalized(query)
    return catalog.filter((item) => {
      const matchesQuery = !term || normalized(`${item.title} ${item.type} ${item.area}`).includes(term)
      return matchesQuery && (area === 'Todas' || item.area === area) && (type === 'Todos' || item.type === type)
    })
  }, [query, area, type])

  function openDocument(id, fallback) {
    setSelectedDocument({ id, ...fallback, ...featuredDocuments[id] })
    setSelectedTopic(null)
    setSection('reader')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openTopic(topic) {
    setSelectedTopic(topic)
    setSection('tema')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (section === 'reader' && selectedDocument) {
    return <Reader document={selectedDocument} onBack={() => setSection(selectedTopic ? 'tema' : 'biblioteca')} dark={dark} setDark={setDark} />
  }

  return (
    <div className="app-shell">
      <Sidebar section={section} setSection={setSection} open={menuOpen} close={() => setMenuOpen(false)} />
      <main className="main-content">
        <Topbar query={query} setQuery={setQuery} setSection={setSection} dark={dark} setDark={setDark} openMenu={() => setMenuOpen(true)} />
        {section === 'inicio' && <Home catalog={catalog} topics={legalTopics} openTopic={openTopic} openDocument={openDocument} setSection={setSection} />}
        {section === 'biblioteca' && (
          <LibraryView
            filtered={filtered} query={query} setQuery={setQuery} area={area} setArea={setArea}
            type={type} setType={setType} areas={areas} types={types} openDocument={openDocument}
          />
        )}
        {section === 'temas' && <Topics topics={legalTopics} openTopic={openTopic} />}
        {section === 'tema' && selectedTopic && <TopicView topic={selectedTopic} openDocument={openDocument} onBack={() => setSection('temas')} />}
        {section === 'atualizacoes' && <Updates />}
      </main>
    </div>
  )
}

function Sidebar({ section, setSection, open, close }) {
  const items = [
    ['inicio', Landmark, 'Início'],
    ['biblioteca', Library, 'Biblioteca'],
    ['temas', Tags, 'Temas jurídicos'],
    ['atualizacoes', CheckCircle2, 'Atualizações'],
  ]
  return (
    <>
      <div className={`mobile-scrim ${open ? 'visible' : ''}`} onClick={close} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <button className="close-menu" onClick={close} aria-label="Fechar menu"><X size={20} /></button>
        <div className="brand-mark"><span>DM</span></div>
        <div className="brand-copy"><strong>Direito Mobile</strong><small>Legislação conectada</small></div>
        <nav>
          {items.map(([id, Icon, label]) => (
            <button key={id} className={section === id || (id === 'temas' && section === 'tema') ? 'active' : ''} onClick={() => { setSection(id); close() }}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Sparkles size={18} />
          <div><strong>Acervo em migração</strong><span>Textos serão conferidos com fontes oficiais.</span></div>
        </div>
      </aside>
    </>
  )
}

function Topbar({ query, setQuery, setSection, dark, setDark, openMenu }) {
  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={openMenu} aria-label="Abrir menu"><Menu size={21} /></button>
      <div className="global-search">
        <Search size={20} />
        <input value={query} onFocus={() => setSection('biblioteca')} onChange={(e) => setQuery(e.target.value)} placeholder="Busque por lei, artigo, assunto ou expressão…" />
        <kbd>⌘ K</kbd>
      </div>
      <button className="icon-button" onClick={() => setDark(!dark)} aria-label="Alternar tema">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
    </header>
  )
}

function Home({ catalog: data, topics, openTopic, openDocument, setSection }) {
  const areas = new Set(data.map((item) => item.area)).size
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={15} /> PESQUISA JURÍDICA INTELIGENTE</div>
        <h1>A lei fica mais clara quando<br /><em>tudo se conecta.</em></h1>
        <p>Consulte normas, encontre artigos e atravesse temas jurídicos sem perder o fio da leitura.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => setSection('biblioteca')}><Search size={18} /> Explorar biblioteca</button>
          <button className="secondary" onClick={() => openTopic(topics[0])}><Tags size={18} /> Ver tema Feminicídio</button>
        </div>
      </section>
      <section className="stats-grid">
        <Stat value={data.length} label="documentos catalogados" detail="extraídos do mapa existente" />
        <Stat value={areas} label="áreas jurídicas" detail="com filtros combináveis" />
        <Stat value="3 níveis" label="de pesquisa" detail="norma, artigo e tema" />
      </section>
      <section className="section-block">
        <SectionTitle eyebrow="NAVEGUE POR ASSUNTO" title="Temas em destaque" action="Ver todos" onAction={() => setSection('temas')} />
        <div className="topic-grid">
          {topics.map((topic) => <TopicCard key={topic.id} topic={topic} onClick={() => openTopic(topic)} />)}
        </div>
      </section>
      <section className="section-block">
        <SectionTitle eyebrow="LEITURA MODULAR" title="Comece pelos documentos conectados" />
        <div className="document-strip">
          {Object.entries(featuredDocuments).slice(0, 4).map(([id, doc]) => (
            <button className="document-card" key={id} onClick={() => openDocument(id, doc)}>
              <span className="document-icon"><FileText size={21} /></span>
              <span><small>{doc.subtitle}</small><strong>{doc.title}</strong><em>{doc.articles.length} dispositivos preparados</em></span>
              <ChevronRight size={19} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Stat({ value, label, detail }) {
  return <div className="stat-card"><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>
}

function SectionTitle({ eyebrow, title, action, onAction }) {
  return <div className="section-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ChevronRight size={17} /></button>}</div>
}

function TopicCard({ topic, onClick }) {
  return (
    <button className="topic-card" onClick={onClick} style={{ '--topic-color': topic.color }}>
      <span className="topic-symbol">§</span>
      <strong>{topic.name}</strong>
      <p>{topic.description}</p>
      <em>{topic.documents.length || 'Em'} documentos {topic.documents.length ? 'relacionados' : 'mapeamento'}</em>
      <ChevronRight size={20} />
    </button>
  )
}

function LibraryView({ filtered, query, setQuery, area, setArea, type, setType, areas, types, openDocument }) {
  const [limit, setLimit] = useState(40)
  useEffect(() => setLimit(40), [query, area, type])
  return (
    <div className="page library-page">
      <div className="page-heading"><span>BIBLIOTECA LEGISLATIVA</span><h1>Todo o acervo em um só lugar</h1><p>O catálogo abaixo foi gerado diretamente do mapa existente do repositório.</p></div>
      <div className="filter-panel">
        <label className="filter-search"><TextSearch size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número, nome, assunto…" /></label>
        <label><Filter size={16} /><select value={type} onChange={(e) => setType(e.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><Tags size={16} /><select value={area} onChange={(e) => setArea(e.target.value)}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="result-meta"><strong>{filtered.length}</strong> documentos encontrados <span>•</span> clique para abrir o leitor</div>
      <div className="catalog-list">
        {filtered.slice(0, limit).map((item) => (
          <button key={`${item.id}-${item.sourceFile}`} className="catalog-row" onClick={() => openDocument(item.id, { title: item.title, subtitle: `${item.type} • ${item.area}`, importStatus: item.importStatus, sourceFile: item.sourceFile })}>
            <span className="type-badge">{item.type}</span>
            <span className="catalog-title"><strong>{item.title}</strong><small>{item.area} • {item.status}</small></span>
            <span className={`availability ${item.importStatus.startsWith('Disponível') ? 'available' : ''}`}>{item.importStatus}</span>
            <ChevronRight size={19} />
          </button>
        ))}
      </div>
      {limit < filtered.length && <button className="load-more" onClick={() => setLimit(limit + 40)}>Mostrar mais 40 documentos</button>}
    </div>
  )
}

function Topics({ topics, openTopic }) {
  return (
    <div className="page topics-page">
      <div className="page-heading"><span>CONEXÕES JURÍDICAS</span><h1>Pesquise pelo problema, não só pelo número da lei</h1><p>Cada tema reúne normas e dispositivos que se complementam.</p></div>
      <div className="topic-grid large">{topics.map((topic) => <TopicCard key={topic.id} topic={topic} onClick={() => openTopic(topic)} />)}</div>
      <div className="coming-card"><Bot size={24} /><div><strong>Classificação semântica em preparação</strong><p>O atualizador oficial e a inteligência artificial ampliarão os temas após a conferência dos textos.</p></div></div>
    </div>
  )
}

function TopicView({ topic, openDocument, onBack }) {
  const docs = topic.documents.map((id) => [id, featuredDocuments[id]]).filter(([, doc]) => doc)
  return (
    <div className="page topic-detail">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Todos os temas</button>
      <div className="topic-hero" style={{ '--topic-color': topic.color }}><span>§</span><div><small>TEMA JURÍDICO</small><h1>{topic.name}</h1><p>{topic.description}</p></div></div>
      <div className="connection-summary"><Link2 size={19} /><strong>{docs.length} documentos</strong><span>e {docs.reduce((sum, [, doc]) => sum + doc.articles.filter((article) => article.topics.includes(topic.name)).length, 0)} dispositivos diretamente relacionados</span></div>
      <div className="topic-results">
        {docs.map(([id, doc]) => (
          <section key={id} className="topic-document">
            <header><div><small>{doc.subtitle}</small><h2>{doc.title}</h2></div><button onClick={() => openDocument(id, doc)}>Abrir norma <ChevronRight size={17} /></button></header>
            {doc.articles.filter((article) => article.topics.includes(topic.name)).map((article) => (
              <button className="article-result" key={article.id} onClick={() => openDocument(id, doc)}><strong>{article.number}</strong><span>{article.heading}<small>{article.text}</small></span><ChevronRight size={18} /></button>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function Reader({ document, onBack, dark, setDark }) {
  const [panel, setPanel] = useState(null)
  const [activeArticle, setActiveArticle] = useState(document.articles?.[0] ?? null)
  const [insideQuery, setInsideQuery] = useState('')
  const [ruler, setRuler] = useState(() => localStorage.getItem('dm-ruler') === 'true')
  const [rulerY, setRulerY] = useState(220)
  const [fontScale, setFontScale] = useState(1)
  const readerRef = useRef(null)
  const articles = document.articles ?? []
  const visibleArticles = articles.filter((article) => normalized(`${article.number} ${article.heading} ${article.text}`).includes(normalized(insideQuery)))

  useEffect(() => localStorage.setItem('dm-ruler', String(ruler)), [ruler])

  function openPanel(name, article) {
    setActiveArticle(article)
    setPanel(name)
  }

  return (
    <div className="reader-shell">
      <header className="reader-topbar">
        <button className="back-link" onClick={onBack}><ArrowLeft size={18} /> Biblioteca</button>
        <div className="reader-tools">
          <button className={ruler ? 'active' : ''} onClick={() => setRuler(!ruler)}><Highlighter size={18} /> Régua</button>
          <button onClick={() => setFontScale(Math.max(.85, fontScale - .1))}>A−</button>
          <button onClick={() => setFontScale(Math.min(1.35, fontScale + .1))}>A+</button>
          <button onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </header>
      <div className="reader-layout">
        <aside className="article-index">
          <small>NESTA NORMA</small>
          <strong>{document.title}</strong>
          <label><Search size={16} /><input value={insideQuery} onChange={(e) => setInsideQuery(e.target.value)} placeholder="Buscar artigo…" /></label>
          <nav>{articles.map((article) => <a key={article.id} href={`#${article.id}`}>{article.number}<span>{article.heading}</span></a>)}</nav>
        </aside>
        <main
          className="reader-document"
          ref={readerRef}
          onPointerMove={(event) => { if (ruler && readerRef.current) setRulerY(event.clientY - readerRef.current.getBoundingClientRect().top) }}
          style={{ '--reader-scale': fontScale }}
        >
          {ruler && <div className="reading-ruler" style={{ top: rulerY }}><span aria-label="Alça da régua">•••</span></div>}
          <header className="law-header"><small>{document.subtitle}</small><h1>{document.title}</h1><p>{document.updatedAt || document.importStatus}</p>{document.source && <a href={document.source} target="_blank" rel="noreferrer">Consultar fonte oficial <Link2 size={15} /></a>}</header>
          {articles.length === 0 ? (
            <div className="import-pending"><BookOpen size={30} /><h2>Documento catalogado</h2><p>O arquivo <code>{document.sourceFile}</code> está preservado no acervo, mas seu texto ainda precisa ser separado do código Wix e conferido com a fonte oficial.</p><span>Próxima etapa: importação e divisão por artigos.</span></div>
          ) : visibleArticles.length ? visibleArticles.map((article) => (
            <article className="law-article" id={article.id} key={article.id}>
              <div className="article-number">{article.number}</div>
              <h2>{article.heading}</h2>
              <p>{article.text}</p>
              {article.penalty && <p className="penalty">{article.penalty}</p>}
              <div className="article-modules">
                <button onClick={() => openPanel('explicacao', article)}><CircleHelp size={16} /> Explicação</button>
                <button onClick={() => openPanel('comentarios', article)}><MessageSquare size={16} /> Comentários</button>
                <button onClick={() => openPanel('relacoes', article)}><Link2 size={16} /> Relações</button>
                <button onClick={() => openPanel('ia', article)}><Sparkles size={16} /> Perguntar à IA</button>
              </div>
            </article>
          )) : <div className="empty-state">Nenhum dispositivo corresponde à busca.</div>}
        </main>
      </div>
      {panel && <ModulePanel type={panel} article={activeArticle} document={document} close={() => setPanel(null)} />}
    </div>
  )
}

function ModulePanel({ type, article, document, close }) {
  const titles = { explicacao: 'Explicação', comentarios: 'Comentários', relacoes: 'Leis relacionadas', ia: 'Assistente jurídico' }
  return (
    <><div className="panel-scrim" onClick={close} /><aside className="module-panel">
      <header><div><small>{article?.number} • {document.title}</small><h2>{titles[type]}</h2></div><button onClick={close}><X size={21} /></button></header>
      {type === 'explicacao' && <div className="module-content"><span className="module-icon"><CircleHelp /></span><p className="explanation">{article.explanation}</p><div className="source-warning">Conteúdo explicativo separado do texto oficial. A revisão editorial será identificada por autor e data.</div></div>}
      {type === 'relacoes' && <div className="module-content"><p>Este dispositivo se conecta às seguintes referências:</p><div className="related-list">{article.related.map((item) => <button key={item}><FileText size={17} /><span>{item}</span><ChevronRight size={17} /></button>)}</div><h3>Temas associados</h3><div className="tag-list">{article.topics.map((topic) => <span key={topic}>{topic}</span>)}</div></div>}
      {type === 'comentarios' && <Comments articleId={`${document.title}:${article.id}`} />}
      {type === 'ia' && <div className="module-content ai-placeholder"><Bot size={34} /><h3>IA fundamentada no artigo</h3><p>A interface está preparada. A resposta será liberada após a indexação oficial, para que a IA cite dispositivos e não responda sem fundamento.</p><button disabled>Perguntar sobre este artigo</button></div>}
    </aside></>
  )
}

function Comments({ articleId }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/comments?articleId=${encodeURIComponent(articleId)}`, { signal: controller.signal })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => { setComments(data.comments ?? []); setStatus(ok ? 'ready' : 'setup') })
      .catch((error) => { if (error.name !== 'AbortError') setStatus('setup') })
    return () => controller.abort()
  }, [articleId])
  async function submit(event) {
    event.preventDefault()
    if (body.trim().length < 3) return
    const response = await fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ articleId, body }) })
    const data = await response.json()
    if (response.ok) { setComments([data.comment, ...comments]); setBody('') } else setStatus('setup')
  }
  return <div className="module-content comments-content">
    {status === 'setup' && <div className="source-warning">O módulo está pronto, mas o banco D1 ainda precisa ser vinculado como <code>DB</code> na Cloudflare.</div>}
    <form onSubmit={submit}><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Escreva um comentário sobre este artigo…" /><div><small>{body.length}/1000</small><button type="submit">Publicar</button></div></form>
    {status === 'loading' ? <p>Carregando comentários…</p> : comments.length ? comments.map((comment) => <div className="comment" key={comment.id}><strong>{comment.author_name || 'Leitor'}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleDateString('pt-BR')}</small></div>) : <div className="empty-comments"><MessageSquare size={25} /><p>Ainda não há comentários neste artigo.</p></div>}
  </div>
}

function Updates() {
  const sources = [
    ['LexML', 'Pesquisa unificada de normas, jurisprudência e documentos', 'Conector planejado'],
    ['Senado Federal', 'Detalhamento de normas por código e URN', 'Conector planejado'],
    ['Câmara dos Deputados', 'Proposições, temas e tramitação', 'Conector planejado'],
    ['INLABS / DOU', 'Publicações do Diário Oficial em XML', 'Conector planejado'],
  ]
  return <div className="page updates-page"><div className="page-heading"><span>ATUALIZAÇÃO GOVERNAMENTAL</span><h1>Fontes oficiais, histórico preservado</h1><p>Nenhuma alteração substituirá silenciosamente o texto publicado.</p></div><div className="update-flow"><span>Buscar</span><ChevronRight/><span>Comparar</span><ChevronRight/><span>Revisar</span><ChevronRight/><span>Publicar</span></div><div className="source-list">{sources.map(([name, desc, status]) => <div key={name}><Landmark size={21}/><span><strong>{name}</strong><small>{desc}</small></span><em>{status}</em></div>)}</div></div>
}

export default App
