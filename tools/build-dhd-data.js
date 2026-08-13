const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");

const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const DOCS_DIR = path.join(ASSETS_DIR, "dhd-docs");
const CATALOG_FILE = path.join(ASSETS_DIR, "dhd-site-index.js");
const REPORT_FILE = path.join(ASSETS_DIR, "dhd-build-report.json");

const INTERNAL_HOSTS = new Set(["www.direitohd.com", "direitohd.com"]);
const SKIP_DIRS = new Set([".git", "node_modules", "assets"]);
const SKIP_EXACT = new Set(["index.old.html", "mapadosite.old.html", "sumulasdostf.old.html", "vademecumonline.old.html"]);

function ensureInsideWorkspace(target) {
  const resolvedRoot = ROOT.toLowerCase();
  const resolvedTarget = path.resolve(target).toLowerCase();

  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Unsafe path outside workspace: ${target}`);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function slugify(value) {
  const basic = normalize(value)
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return basic || "doc";
}

function compactNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function posixRel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function findHtmlFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        findHtmlFiles(path.join(dir, entry.name), result);
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) {
      continue;
    }

    if (entry.name.toLowerCase().endsWith(".old.html") || SKIP_EXACT.has(entry.name)) {
      continue;
    }

    result.push(path.join(dir, entry.name));
  }

  return result;
}

function pathFromHref(href, fromPath) {
  const raw = cleanText(href);

  if (!raw || /^(mailto|tel|javascript):/i.test(raw)) {
    return "";
  }

  try {
    const parsed = new URL(raw, "https://www.direitohd.com/" + fromPath);

    if (!INTERNAL_HOSTS.has(parsed.hostname)) {
      return raw;
    }

    let pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

    if (!pathname || pathname.endsWith("/")) {
      pathname += "index.html";
    }

    if (!pathname.toLowerCase().endsWith(".html")) {
      pathname += ".html";
    }

    return path.posix.normalize(pathname);
  } catch (error) {
    const noHash = raw.split("#")[0].split("?")[0];
    if (!noHash) {
      return "";
    }

    const base = path.posix.dirname(fromPath);
    return path.posix.normalize(path.posix.join(base, decodeURIComponent(noHash)));
  }
}

function isExternalHref(href) {
  return /^https?:\/\//i.test(href) && !INTERNAL_HOSTS.has(new URL(href).hostname);
}

function safeHref(href, fromPath) {
  const raw = cleanText(href);

  if (!raw || /^(javascript|data):/i.test(raw)) {
    return "";
  }

  if (/^(https?:|mailto:|tel:)/i.test(raw)) {
    return raw;
  }

  return pathFromHref(raw, fromPath) || raw;
}

function inlineHtml($, node, fromPath) {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return escapeHtml(node.data || "");
  }

  if (node.type !== "tag") {
    return "";
  }

  const name = String(node.name || "").toLowerCase();
  const attribs = node.attribs || {};
  const style = attribs.style || "";
  const children = (node.children || []).map((child) => inlineHtml($, child, fromPath)).join("");

  if (!children && name !== "br") {
    return "";
  }

  if (name === "br") {
    return "<br>";
  }

  if (name === "a") {
    const href = safeHref(attribs.href, fromPath);
    if (!href) {
      return children;
    }

    const external = /^https?:\/\//i.test(href) && isExternalHref(href);
    const rel = external ? ' rel="noreferrer noopener"' : "";
    const target = external ? ' target="_blank"' : "";
    return `<a href="${escapeAttr(href)}"${target}${rel}>${children}</a>`;
  }

  if (name === "strong" || name === "b" || /font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) {
    return `<strong>${children}</strong>`;
  }

  if (name === "em" || name === "i" || /font-style\s*:\s*italic/i.test(style)) {
    return `<em>${children}</em>`;
  }

  if (name === "u" || /text-decoration\s*:\s*underline/i.test(style)) {
    return `<u>${children}</u>`;
  }

  if (/background(?:-color)?\s*:/i.test(style)) {
    return `<mark>${children}</mark>`;
  }

  return children;
}

function blockHtml($, element, fromPath) {
  return (element.children || []).map((child) => inlineHtml($, child, fromPath)).join("").trim();
}

function blockStyle(element) {
  return (element.attribs && element.attribs.style) || "";
}

function detectArticle(text) {
  const match = cleanText(text).match(/^Art\.?\s*(\d+[A-Za-z]?)(?:\s*[.º°oª]+)?(?:\s*-\s*([A-Za-z]))?/i);

  if (!match) {
    return "";
  }

  return (match[1] + (match[2] ? `-${match[2]}` : "")).toUpperCase();
}

function detectParagraph(text) {
  const normalized = normalize(text);
  const paragraph = normalized.match(/^(?:§|par(?:agrafo)?\.?)\s*(unico|\d+[a-z]?)/);

  if (paragraph) {
    return paragraph[1].toUpperCase();
  }

  if (/^paragrafo unico\b/.test(normalized)) {
    return "UNICO";
  }

  return "";
}

function detectInciso(text) {
  const normalized = normalize(text);
  const match = normalized.match(/^([ivxlcdm]{1,8}|\d{1,3})\s*[-–]/);

  return match ? match[1].toUpperCase() : "";
}

function detectAlinea(text) {
  const normalized = normalize(text);
  const match = normalized.match(/^["']?([a-z])["']?\s*\)/);

  return match ? match[1].toLowerCase() : "";
}

function isHeadingText(text) {
  const normalized = normalize(text);

  return /^(livro|parte|titulo|capitulo|secao|subsecao)\b/.test(normalized) ||
    (/^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ0-9\s.,º°ªIVXLCDM-]{4,}$/.test(cleanText(text)) && cleanText(text).length < 140);
}

function classifyBlock(text, tag, style) {
  const normalized = normalize(text);
  const article = detectArticle(text);

  if (article) {
    return "article";
  }

  if (/^h[1-6]$/.test(tag) || isHeadingText(text) || /text-align\s*:\s*center/i.test(style) && cleanText(text).length < 170) {
    return "heading";
  }

  if (/font-size\s*:\s*(1[0-4]px|0\.)/i.test(style) || /margin-left\s*:\s*(?:[4-9]\d|[1-9]\d{2,})px/i.test(style)) {
    return "annotation";
  }

  if (/^(legislacao correlata|jurisprudencia|notas?|vide:|processo:|tema|destaque|informacoes do inteiro teor)\b/.test(normalized)) {
    return "annotation";
  }

  if (detectInciso(text) || detectAlinea(text) || detectParagraph(text)) {
    return "paragraph";
  }

  return "paragraph";
}

function preferredTitle($) {
  const title = cleanText($("title").first().text());
  if (title) {
    return title;
  }

  const heading = cleanText($('[data-testid="richTextElement"]').find("h1,h2,h3,h4").first().text());
  return heading || "DireitoHD";
}

function metaContent($, selector) {
  return cleanText($(selector).first().attr("content"));
}

function extractLinks($, scope, fromPath) {
  const seen = new Set();
  const links = [];

  scope.find("a[href]").each((_, anchor) => {
    const $anchor = $(anchor);
    const href = safeHref($anchor.attr("href"), fromPath);
    const text = cleanText($anchor.attr("aria-label") || $anchor.text());

    if (!href || !text || text.length < 2 || /^#/.test(href)) {
      return;
    }

    const key = `${href}|${text}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    links.push({
      href,
      text,
      external: /^https?:\/\//i.test(href) && isExternalHref(href),
    });
  });

  return links.slice(0, 240);
}

function extractBlocks($, scope, fromPath) {
  const nodes = [];

  scope.find('[data-testid="richTextElement"]').each((_, rich) => {
    $(rich).find("h1,h2,h3,h4,h5,h6,p,li,td,th").each((__, item) => nodes.push(item));
  });

  if (!nodes.length) {
    scope.find("h1,h2,h3,h4,h5,h6,p,li").each((_, item) => nodes.push(item));
  }

  const blocks = [];
  let previous = "";

  nodes.forEach((item) => {
    const tag = String(item.name || "").toLowerCase();
    const text = cleanText($(item).text());

    if (text.length < 2 || text === previous) {
      return;
    }

    if (/^(top of page|bottom of page|ir para:)$/i.test(text)) {
      return;
    }

    const html = blockHtml($, item, fromPath);

    if (!cleanText($("<div>").html(html).text())) {
      return;
    }

    previous = text;

    const style = blockStyle(item);
    const article = detectArticle(text);
    const kind = classifyBlock(text, tag, style);

    blocks.push({
      id: "",
      kind,
      tag: /^h[1-6]$/.test(tag) ? tag : "p",
      text,
      html,
      article,
      paragraph: detectParagraph(text),
      inciso: detectInciso(text),
      alinea: detectAlinea(text),
      contextArticle: "",
    });
  });

  let currentArticle = "";
  const usedIds = new Map();

  blocks.forEach((block, index) => {
    if (block.article) {
      currentArticle = block.article;
    } else if (block.kind === "heading") {
      currentArticle = "";
    } else if (currentArticle) {
      block.contextArticle = currentArticle;
    }

    const base = block.article
      ? `art-${slugify(block.article)}`
      : block.kind === "heading"
        ? `sec-${index}`
        : `b-${index}`;
    const count = usedIds.get(base) || 0;
    usedIds.set(base, count + 1);
    block.id = count ? `${base}-${count + 1}` : base;
  });

  return blocks;
}

function buildToc(blocks) {
  const toc = [];
  const seenArticles = new Set();

  for (const block of blocks) {
    if (block.kind === "heading" && block.text.length < 150) {
      toc.push({
        id: block.id,
        label: block.text,
        kind: "heading",
      });
      continue;
    }

    if (block.article && !seenArticles.has(block.article)) {
      seenArticles.add(block.article);
      toc.push({
        id: block.id,
        label: `Art. ${block.article}`,
        kind: "article",
      });
    }
  }

  return toc.slice(0, 260);
}

function docKind(filePath, title) {
  const value = normalize(`${filePath} ${title}`);

  if (/\bsumula/.test(value)) return "sumula";
  if (/\bcodigo|^cp-|^cpp-|codigo-/.test(value)) return "codigo";
  if (/\bdecreto|\bdec[-\d]/.test(value)) return "decreto";
  if (/\bmp\d|\bmedida provisoria/.test(value)) return "mp";
  if (/\blei|^lei/.test(value)) return "lei";
  if (/\bresolucao|\bres[-\d]/.test(value)) return "resolucao";
  if (/\bato\b|^ato/.test(value)) return "ato";
  if (/\bportaria|^portaria/.test(value)) return "portaria";
  return "pagina";
}

function buildDoc(file) {
  const rel = posixRel(file);
  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html, { decodeEntities: true });
  const scope = $("main#PAGES_CONTAINER").length ? $("main#PAGES_CONTAINER") : $("body");
  const title = preferredTitle($);
  const description = metaContent($, 'meta[name="description"]');
  const keywords = metaContent($, 'meta[name="keywords"]');
  const blocks = extractBlocks($, scope, rel);
  const links = extractLinks($, scope, rel);
  const articleRefs = [...new Set(blocks.map((block) => block.article).filter(Boolean))];
  const text = cleanText(blocks.map((block) => block.text).join(" "));
  const hash = crypto.createHash("sha1").update(rel).digest("hex").slice(0, 8);
  const slug = `${slugify(rel)}-${hash}`;

  return {
    slug,
    path: rel,
    title,
    description,
    keywords,
    kind: docKind(rel, title),
    stats: {
      blocks: blocks.length,
      articles: articleRefs.length,
      links: links.length,
      chars: text.length,
    },
    articleRefs,
    compact: compactNumber(`${rel} ${title} ${description} ${keywords}`),
    searchText: cleanText(`${title} ${description} ${keywords} ${rel} ${articleRefs.join(" ")}`).slice(0, 6000),
    toc: buildToc(blocks),
    links,
    blocks,
  };
}

function isUsefulDoc(doc) {
  const title = cleanText(doc.title);
  const rel = doc.path.toLowerCase();

  if (/^\d{3}\s+error:/i.test(title)) {
    return false;
  }

  if (/[${}]/.test(doc.path) || /(?:^|\/)[a-z],location\.html$/i.test(doc.path) || rel.endsWith("window.location.html")) {
    return false;
  }

  if (doc.stats.chars < 120 && doc.stats.links === 0) {
    return false;
  }

  return true;
}

function main() {
  ensureInsideWorkspace(DOCS_DIR);
  fs.rmSync(DOCS_DIR, { recursive: true, force: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const files = findHtmlFiles(ROOT).sort((a, b) => posixRel(a).localeCompare(posixRel(b), "pt-BR"));
  const rawDocs = files.map(buildDoc);
  const docs = rawDocs.filter(isUsefulDoc);

  for (const doc of docs) {
    const file = path.join(DOCS_DIR, `${doc.slug}.json`);
    fs.writeFileSync(file, `${JSON.stringify(doc)}\n`, "utf8");
  }

  const catalog = docs.map((doc) => ({
    title: doc.title,
    path: doc.path,
    doc: doc.slug,
    description: doc.description,
    keywords: doc.keywords,
    kind: doc.kind,
    stats: doc.stats,
    articleRefs: doc.articleRefs,
    compact: doc.compact,
    searchText: doc.searchText,
  }));

  const catalogJs = [
    "window.DHD_CATALOG = ",
    JSON.stringify(catalog, null, 2),
    ";\nwindow.DHD_SITE_INDEX = window.DHD_CATALOG;\n",
  ].join("");
  fs.writeFileSync(CATALOG_FILE, catalogJs, "utf8");

  const report = {
    generatedAt: new Date().toISOString(),
    files: docs.length,
    skipped: rawDocs.length - docs.length,
    docsDir: path.relative(ROOT, DOCS_DIR),
    catalog: path.relative(ROOT, CATALOG_FILE),
    blocks: docs.reduce((sum, doc) => sum + doc.stats.blocks, 0),
    articles: docs.reduce((sum, doc) => sum + doc.stats.articles, 0),
    largest: docs
      .slice()
      .sort((a, b) => b.stats.chars - a.stats.chars)
      .slice(0, 12)
      .map((doc) => ({
        path: doc.path,
        title: doc.title,
        chars: doc.stats.chars,
        blocks: doc.stats.blocks,
        articles: doc.stats.articles,
      })),
  };

  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`DireitoHD data built: ${report.files} pages, ${report.blocks} blocks, ${report.articles} article anchors.`);
}

main();
