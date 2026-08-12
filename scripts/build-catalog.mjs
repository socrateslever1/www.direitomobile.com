import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = await readFile(resolve(root, 'mapadosite.html'), 'utf8')

const entities = {
  amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>',
  ordm: 'º', ordf: 'ª', sect: '§', aacute: 'á', agrave: 'à', acirc: 'â',
  atilde: 'ã', eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', ocirc: 'ô',
  otilde: 'õ', uacute: 'ú', ccedil: 'ç', Aacute: 'Á', Eacute: 'É', Iacute: 'Í',
  Oacute: 'Ó', Uacute: 'Ú', Ccedil: 'Ç', ndash: '–', mdash: '—', hellip: '…',
}

function decode(value) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name) => entities[name] ?? entity)
}

function text(value) {
  return decode(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalizeHref(value) {
  const clean = decode(value).split(/[?#]/)[0].replace(/^\.\//, '')
  if (!clean || /^(?:https?:|mailto:|tel:|javascript:|#)/i.test(clean)) return null
  return clean.endsWith('.html') ? clean : `${clean}.html`
}

function typeFrom(label) {
  const value = label.toLowerCase()
  if (value.includes('constitui')) return 'Constituição'
  if (value.includes('código') || /\b(?:cpm|cpp|cpc|ctb)\b/i.test(label)) return 'Código'
  if (value.includes('súmula')) return 'Súmula'
  if (value.includes('decreto') || /\bdec\.?\s/i.test(label)) return 'Decreto'
  if (value.includes('resolução') || /\bres\.?\s/i.test(label)) return 'Resolução'
  if (value.includes('portaria')) return 'Portaria'
  if (value.includes('medida provisória') || /^-?\s*mp\s/i.test(label)) return 'Medida Provisória'
  if (value.includes('regimento')) return 'Regimento'
  if (value.includes('convenção') || value.includes('pacto')) return 'Tratado'
  if (value.includes('ato ')) return 'Ato'
  if (value.includes('lei')) return 'Lei'
  return 'Documento'
}

function areaFrom(label, href) {
  const value = `${label} ${href}`.toLowerCase()
  if (/penitenci|execução penal|\blep\b|prisional/.test(value)) return 'Direito Penitenciário'
  if (/processo penal|\bcpp\b|investiga|prisão|criminal/.test(value)) return 'Processo Penal'
  if (/penal|crime|drogas|desarmamento|feminic|tortura|hediond/.test(value)) return 'Direito Penal'
  if (/trânsito|detran|veículo|mobilidade|\bctb\b/.test(value)) return 'Direito de Trânsito'
  if (/militar|forças armadas|\bcpm\b/.test(value)) return 'Direito Militar'
  if (/criança|adolescente|\beca\b|idoso|defici/.test(value)) return 'Tutelas Especiais'
  if (/digital|internet|dados|lgpd|cibern/.test(value)) return 'Direito Digital'
  if (/constitui|stf|judiciária|tribunal/.test(value)) return 'Direito Constitucional'
  if (/civil|família|inquilinato|arbitragem|mediação/.test(value)) return 'Direito Civil'
  if (/administr|licita|servidor|segurança pública|concurso/.test(value)) return 'Direito Administrativo'
  if (/consumidor/.test(value)) return 'Direito do Consumidor'
  if (/ambient|agrári|florestal|animal/.test(value)) return 'Direito Ambiental'
  if (/eleitoral|eleições|partido/.test(value)) return 'Direito Eleitoral'
  if (/direitos humanos|igualdade racial/.test(value)) return 'Direitos Humanos'
  if (/internacional|convenção|pacto|nações unidas/.test(value)) return 'Direito Internacional'
  if (/financeiro|crédito|banco|coaf/.test(value)) return 'Direito Financeiro'
  if (/empresa|franquia|concorrência|sociedade/.test(value)) return 'Direito Empresarial'
  return 'Outros'
}

const candidates = new Map()
const anchors = source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)

for (const match of anchors) {
  const href = normalizeHref(match[1])
  const label = text(match[2]).replace(/^[-–—]\s*/, '')
  if (!href || label.length < 4 || label.length > 240) continue
  if (/^(início|home|topo|login|mapa do site|vade mecum on-line)$/i.test(label)) continue
  const file = decodeURIComponent(href)
  let available = true
  try { await access(resolve(root, file)) } catch { available = false }
  const slug = basename(file, '.html').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  candidates.set(href.toLowerCase(), {
    id: slug,
    title: label,
    type: typeFrom(label),
    area: areaFrom(label, href),
    sourceFile: file,
    status: /revogad|históric/i.test(label) ? 'Histórica/Revogada' : 'A conferir',
    importStatus: available ? 'Disponível no acervo' : 'Referenciada',
  })
}

const catalog = [...candidates.values()].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
await mkdir(resolve(root, 'src/data'), { recursive: true })
await writeFile(resolve(root, 'src/data/catalog.generated.json'), `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Catálogo gerado: ${catalog.length} documentos encontrados no mapa do site.`)
