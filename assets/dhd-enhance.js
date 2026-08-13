(function () {
  "use strict";

  var DOC_CACHE = new Map();
  var ARTICLE_LIMIT = 80;
  var CATALOG_LIMIT = 80;
  var PAGE_HIT_LIMIT = 80;
  var GENERIC_WORDS = new Set([
    "a",
    "ao",
    "aos",
    "as",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "na",
    "nas",
    "no",
    "nos",
    "o",
    "os",
    "para",
    "por",
    "que",
    "um",
    "uma",
  ]);
  var LEGAL_WORDS = new Set([
    "alinea",
    "alineas",
    "art",
    "artigo",
    "artigos",
    "caput",
    "inc",
    "inciso",
    "incisos",
    "lei",
    "leis",
    "par",
    "paragrafo",
    "paragrafos",
  ]);

  var state = {
    root: "",
    path: "",
    doc: null,
    catalog: [],
    catalogByPath: new Map(),
    query: "",
    queryTimer: 0,
    kindFilter: "todos",
    showAnnotations: true,
    compactMode: false,
    activeId: "",
    elements: {},
  };

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }

    fn();
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

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (typeof text === "string") {
      element.textContent = text;
    }

    return element;
  }

  function clear(element) {
    while (element && element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function findSiteRoot() {
    var scripts = Array.prototype.slice.call(document.scripts);
    var script = scripts.find(function (item) {
      var src = (item.getAttribute("src") || "").replace(/\\/g, "/");
      return /(^|\/)assets\/dhd-enhance\.js(?:[?#].*)?$/.test(src);
    });

    if (script && script.src) {
      try {
        return new URL("../", script.src).href;
      } catch (error) {
        return document.baseURI;
      }
    }

    return new URL("./", document.baseURI).href;
  }

  function currentPathFromLocation() {
    try {
      var root = new URL(state.root);
      var current = new URL(window.location.href);
      var rootPath = decodeURIComponent(root.pathname);
      var pathname = decodeURIComponent(current.pathname);

      if (rootPath !== "/" && pathname.indexOf(rootPath) === 0) {
        pathname = pathname.slice(rootPath.length);
      }

      pathname = pathname.replace(/^\/+/, "");

      if (!pathname || pathname.endsWith("/")) {
        pathname += "index.html";
      }

      if (!/\.html$/i.test(pathname)) {
        pathname += ".html";
      }

      return pathname;
    } catch (error) {
      return "index.html";
    }
  }

  function keyPath(value) {
    try {
      return decodeURIComponent(String(value || "")).replace(/\\/g, "/").toLowerCase();
    } catch (error) {
      return String(value || "").replace(/\\/g, "/").toLowerCase();
    }
  }

  function hrefFor(path, query) {
    var url = new URL(path || "index.html", state.root);

    if (query) {
      url.searchParams.set("q", query);
    }

    return url.href;
  }

  function pathFromHref(href) {
    try {
      var url = new URL(href, state.root);
      var root = new URL(state.root);

      if (url.origin !== root.origin) {
        return "";
      }

      var pathname = decodeURIComponent(url.pathname);
      var rootPath = decodeURIComponent(root.pathname);

      if (rootPath !== "/" && pathname.indexOf(rootPath) === 0) {
        pathname = pathname.slice(rootPath.length);
      }

      pathname = pathname.replace(/^\/+/, "");

      if (!pathname || pathname.endsWith("/")) {
        pathname += "index.html";
      }

      if (!/\.html$/i.test(pathname)) {
        pathname += ".html";
      }

      return pathname;
    } catch (error) {
      return "";
    }
  }

  function findEntry(path) {
    return state.catalogByPath.get(keyPath(path)) || state.catalogByPath.get("index.html") || null;
  }

  function isHomePath(path) {
    return keyPath(path || state.path) === "index.html";
  }

  function numberVariants(value) {
    var variants = [];

    (normalize(value).match(/\d[\d.\-/]*/g) || []).forEach(function (token) {
      var compact = token.replace(/\D/g, "");

      if (compact) {
        variants.push(compact);
      }

      if (compact.length > 4) {
        variants.push(compact.slice(0, -4));
      }

      (token.match(/\d+/g) || []).forEach(function (part) {
        if (part.length > 1) {
          variants.push(part);
        }
      });
    });

    return Array.from(new Set(variants));
  }

  function searchableText(value) {
    var variants = numberVariants(value);
    var normalized = normalize(value);

    return variants.length ? normalized + " " + variants.join(" ") : normalized;
  }

  function parseQuery(query) {
    var raw = cleanText(query);
    var norm = normalize(raw)
      .replace(/\bartigos?\b/g, "art")
      .replace(/\bparagrafos?\b/g, "par")
      .replace(/\bparagrafo unico\b/g, "par unico");
    var article = norm.match(/\bart(?:igo)?\.?\s*(\d+[a-z]?(?:\s*-\s*[a-z])?)/);
    var inciso = norm.match(/\b(?:inc(?:iso)?\.?|incisos?)\s*([ivxlcdm]+|\d+)/);
    var alinea = norm.match(/\b(?:alinea|alineas)\s*["']?([a-z])["']?/);
    var paragraph = norm.match(/(?:§|par(?:agrafo)?\.?)\s*(unico|\d+[a-z]?)/);
    var law = norm.match(/\b(?:lei|decreto|dec|codigo|mp|medida provisoria|lc|lei complementar)\D*(\d[\d.\-/]*)/);
    var rawTerms = norm.replace(/[^a-z0-9]+/g, " ").match(/[a-z0-9]+/g) || [];
    var variants = numberVariants(raw);
    var terms = rawTerms.filter(function (term) {
      if (GENERIC_WORDS.has(term)) {
        return false;
      }

      return term.length > 1 || /^\d+$/.test(term);
    });
    var strictTerms = terms.filter(function (term) {
      return !LEGAL_WORDS.has(term) && !/^\d+$/.test(term);
    });

    return {
      raw: raw,
      norm: norm,
      article: article ? article[1].replace(/\s+/g, "").toUpperCase() : "",
      inciso: inciso ? inciso[1].toUpperCase() : "",
      alinea: alinea ? alinea[1].toLowerCase() : "",
      paragraph: paragraph ? paragraph[1].toUpperCase() : "",
      lawCompact: law ? law[1].replace(/\D/g, "") : "",
      terms: Array.from(new Set(terms.concat(variants))),
      strictTerms: Array.from(new Set(strictTerms)),
      variants: variants,
    };
  }

  function canSearch(parsed) {
    return parsed.raw.length > 1 && (
      parsed.article ||
      parsed.lawCompact ||
      parsed.inciso ||
      parsed.alinea ||
      parsed.paragraph ||
      parsed.terms.some(function (term) { return term.length > 1; })
    );
  }

  function hasNumberToken(norm, term) {
    return new RegExp("(^|\\D)" + escapeRegex(term) + "(?!\\d)").test(norm);
  }

  function includesTerm(norm, term) {
    if (/^\d+$/.test(term)) {
      return hasNumberToken(norm, term);
    }

    return norm.indexOf(term) >= 0;
  }

  function hasArticleRef(norm, article) {
    return new RegExp("\\bart\\.?\\s*" + escapeRegex(normalize(article)).replace("\\-", "\\s*-\\s*") + "(?!\\d)").test(norm);
  }

  function blockSearchText(block, doc) {
    return searchableText([
      block.text,
      block.article ? "art " + block.article : "",
      block.contextArticle ? "art " + block.contextArticle : "",
      block.inciso ? "inciso " + block.inciso : "",
      block.alinea ? "alinea " + block.alinea : "",
      doc ? doc.title : "",
    ].join(" "));
  }

  function allTermsMatch(norm, parsed) {
    var terms = parsed.strictTerms.length ? parsed.strictTerms : parsed.terms.filter(function (term) {
      return !LEGAL_WORDS.has(term);
    });

    if (!terms.length) {
      return Boolean(parsed.article || parsed.inciso || parsed.alinea || parsed.paragraph || parsed.lawCompact);
    }

    return terms.every(function (term) {
      return includesTerm(norm, term);
    });
  }

  function scoreBlock(block, parsed, doc) {
    var norm = blockSearchText(block, doc);
    var score = 0;

    if (!canSearch(parsed)) {
      return 0;
    }

    if (parsed.article) {
      if (normalize(block.article) === normalize(parsed.article)) {
        score += 160;
      } else if (normalize(block.contextArticle) === normalize(parsed.article)) {
        score += 95;
      } else if (hasArticleRef(norm, parsed.article)) {
        score += 45;
      } else {
        return 0;
      }
    }

    if (parsed.inciso) {
      if (normalize(block.inciso) === normalize(parsed.inciso)) {
        score += 80;
      } else if (!includesTerm(norm, normalize(parsed.inciso))) {
        score -= 18;
      }
    }

    if (parsed.alinea) {
      if (normalize(block.alinea) === normalize(parsed.alinea)) {
        score += 80;
      } else if (!includesTerm(norm, normalize(parsed.alinea))) {
        score -= 18;
      }
    }

    if (parsed.paragraph) {
      if (normalize(block.paragraph) === normalize(parsed.paragraph)) {
        score += 70;
      } else if (!includesTerm(norm, normalize(parsed.paragraph))) {
        score -= 14;
      }
    }

    if (!allTermsMatch(norm, parsed) && !parsed.article) {
      return 0;
    }

    parsed.terms.forEach(function (term) {
      if (includesTerm(norm, term)) {
        score += /^\d+$/.test(term) ? 8 : 14;
      }
    });

    if (block.kind === "article") {
      score += 18;
    } else if (block.kind === "heading") {
      score += 8;
    } else if (block.kind === "annotation") {
      score += 3;
    }

    return Math.max(0, score);
  }

  function catalogSearchText(entry) {
    return searchableText([
      entry.title,
      entry.description,
      entry.keywords,
      entry.path,
      entry.kind,
      (entry.articleRefs || []).map(function (article) { return "art " + article; }).join(" "),
      entry.searchText,
    ].join(" "));
  }

  function scoreCatalogEntry(entry, parsed) {
    var titleNorm = searchableText(entry.title);
    var fullNorm = catalogSearchText(entry);
    var compact = entry.compact || String(entry.path || "").replace(/\D/g, "");
    var score = 0;

    if (!canSearch(parsed)) {
      return 0;
    }

    if (parsed.lawCompact) {
      if (compact.indexOf(parsed.lawCompact) >= 0 || String(entry.path || "").replace(/\D/g, "").indexOf(parsed.lawCompact) >= 0) {
        score += 180;
      } else if (fullNorm.indexOf(parsed.lawCompact) >= 0) {
        score += 100;
      } else {
        return 0;
      }
    }

    if (parsed.article) {
      if ((entry.articleRefs || []).some(function (article) { return normalize(article) === normalize(parsed.article); })) {
        score += parsed.lawCompact ? 70 : 28;
      } else if (!parsed.lawCompact) {
        score -= 16;
      }
    }

    if (!allTermsMatch(fullNorm, parsed) && !parsed.lawCompact && !parsed.article) {
      return 0;
    }

    parsed.terms.forEach(function (term) {
      if (includesTerm(titleNorm, term)) {
        score += 24;
      } else if (includesTerm(fullNorm, term)) {
        score += 9;
      }
    });

    parsed.variants.forEach(function (variant) {
      if (compact.indexOf(variant) >= 0) {
        score += 30;
      }
    });

    if (entry.kind === "lei" || entry.kind === "codigo") {
      score += 8;
    }

    return Math.max(0, score);
  }

  function pageHits(parsed) {
    if (!state.doc || !Array.isArray(state.doc.blocks)) {
      return [];
    }

    return state.doc.blocks
      .map(function (block) {
        return Object.assign({}, block, { score: scoreBlock(block, parsed, state.doc) });
      })
      .filter(function (block) {
        return block.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, PAGE_HIT_LIMIT);
  }

  function catalogHits(parsed) {
    return state.catalog
      .map(function (entry) {
        return Object.assign({}, entry, { score: scoreCatalogEntry(entry, parsed) });
      })
      .filter(function (entry) {
        return entry.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score || a.title.localeCompare(b.title, "pt-BR");
      })
      .slice(0, CATALOG_LIMIT);
  }

  function snippet(text, parsed) {
    var original = cleanText(text);
    var norm = normalize(original);
    var candidates = [];

    if (parsed.article) {
      candidates.push("art " + normalize(parsed.article));
      candidates.push(normalize(parsed.article));
    }

    candidates = candidates.concat(parsed.strictTerms.length ? parsed.strictTerms : parsed.terms);

    var index = candidates.reduce(function (best, term) {
      var next = norm.indexOf(normalize(term));
      return next >= 0 && (best < 0 || next < best) ? next : best;
    }, -1);
    var start = index > 110 ? index - 90 : 0;
    var value = original.slice(start, start + 310);

    if (start > 0) {
      value = "... " + value;
    }

    if (start + 310 < original.length) {
      value += " ...";
    }

    return value;
  }

  function highlightText(value, parsed) {
    var terms = (parsed.strictTerms.length ? parsed.strictTerms : parsed.terms).filter(function (term) {
      return term.length > 1 && !LEGAL_WORDS.has(term);
    }).slice(0, 8);
    var escaped = escapeHtml(value);

    terms.forEach(function (term) {
      var pattern = new RegExp("(" + escapeRegex(term) + ")", "ig");
      escaped = escaped.replace(pattern, "<mark>$1</mark>");
    });

    if (parsed.article) {
      escaped = escaped.replace(new RegExp("(Art\\.?\\s*" + escapeRegex(parsed.article) + ")", "ig"), "<mark>$1</mark>");
    }

    return escaped;
  }

  function resultBadge(block) {
    if (block.article) return "Art. " + block.article;
    if (block.contextArticle) return "Art. " + block.contextArticle;
    if (block.inciso) return "Inc. " + block.inciso;
    if (block.alinea) return "Al. " + block.alinea;
    if (block.kind === "heading") return "Seção";
    if (block.kind === "annotation") return "Nota";
    return "Trecho";
  }

  function performSearch(query, goToBest) {
    var parsed = parseQuery(query);
    var currentHits = pageHits(parsed);
    var foundCatalog = catalogHits(parsed);
    var articleOnly = Boolean(parsed.article && !parsed.lawCompact && !parsed.strictTerms.length);

    if (articleOnly && state.doc && !isHomePath(state.doc.path)) {
      foundCatalog = [];
    }

    state.query = parsed.raw;
    renderResults(parsed, currentHits, foundCatalog);
    renderCatalogList(foundCatalog.length ? foundCatalog : null);

    if (state.elements.count) {
      state.elements.count.textContent = canSearch(parsed)
        ? currentHits.length + " nesta página | " + foundCatalog.length + " acervo"
        : state.catalog.length + " páginas";
    }

    if (!goToBest || !canSearch(parsed)) {
      return;
    }

    if (currentHits.length) {
      scrollToBlock(currentHits[0].id);
      return;
    }

    if (foundCatalog.length) {
      var targetQuery = parsed.article ? "art " + parsed.article : parsed.raw;
      navigateTo(foundCatalog[0].path, targetQuery);
    }
  }

  function renderResults(parsed, currentHits, foundCatalog) {
    var panel = state.elements.results;
    clear(panel);

    if (!parsed.raw) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;

    if (!canSearch(parsed)) {
      panel.appendChild(createElement("p", "dhd-empty", "Digite mais detalhes para buscar."));
      return;
    }

    var summary = createElement("div", "dhd-results-summary");
    summary.appendChild(createElement("strong", "", "Busca: " + parsed.raw));
    summary.appendChild(createElement("span", "", currentHits.length + " nesta página | " + foundCatalog.length + " no acervo"));
    panel.appendChild(summary);

    var grid = createElement("div", "dhd-results-grid");
    var currentSection = resultSection("Neste documento", currentHits, parsed, true);
    var catalogSection = resultSection("Acervo", foundCatalog, parsed, false);

    if (parsed.lawCompact || /^lei\b|^decreto\b|^codigo\b|^mp\b/.test(parsed.norm)) {
      grid.appendChild(catalogSection);
      grid.appendChild(currentSection);
    } else {
      grid.appendChild(currentSection);
      grid.appendChild(catalogSection);
    }

    panel.appendChild(grid);
  }

  function resultSection(title, hits, parsed, isPageHit) {
    var section = createElement("section", "dhd-result-section");
    var heading = createElement("h2", "dhd-result-heading", title);
    section.appendChild(heading);

    if (!hits.length) {
      section.appendChild(createElement("p", "dhd-empty", "Nada encontrado."));
      return section;
    }

    var list = createElement("ol", "dhd-result-list");

    hits.forEach(function (hit) {
      var item = createElement("li", "dhd-result-item");

      if (isPageHit) {
        var button = createElement("button", "dhd-result-button");
        button.type = "button";
        button.appendChild(resultTop(resultBadge(hit), hit.score));
        var line = createElement("span", "dhd-result-text");
        line.innerHTML = highlightText(snippet(hit.text, parsed), parsed);
        button.appendChild(line);
        button.addEventListener("click", function () {
          scrollToBlock(hit.id);
        });
        item.appendChild(button);
      } else {
        var link = createElement("a", "dhd-result-link");
        var query = parsed.article ? "art " + parsed.article : parsed.raw;
        link.href = hrefFor(hit.path, query);
        link.appendChild(resultTop(kindLabel(hit.kind), hit.score));
        link.appendChild(createElement("span", "dhd-result-text", hit.title));
        link.appendChild(createElement("span", "dhd-result-meta", hit.path));
        item.appendChild(link);
      }

      list.appendChild(item);
    });

    section.appendChild(list);
    return section;
  }

  function resultTop(label, score) {
    var top = createElement("span", "dhd-result-top");
    top.appendChild(createElement("span", "dhd-badge", label));
    top.appendChild(createElement("span", "dhd-score", String(Math.round(score))));
    return top;
  }

  function kindLabel(kind) {
    var labels = {
      ato: "Ato",
      codigo: "Código",
      decreto: "Decreto",
      lei: "Lei",
      mp: "MP",
      pagina: "Página",
      portaria: "Portaria",
      resolucao: "Resolução",
      sumula: "Súmula",
    };

    return labels[kind] || "Página";
  }

  function scrollToBlock(id) {
    if (!id) return;

    var previous = document.querySelector(".dhd-hit-active");
    var target = document.getElementById(id);

    if (previous) {
      previous.classList.remove("dhd-hit-active");
    }

    if (!target) {
      return;
    }

    state.activeId = id;
    target.classList.add("dhd-hit-active");
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function loadCatalog() {
    state.catalog = Array.isArray(window.DHD_CATALOG)
      ? window.DHD_CATALOG
      : Array.isArray(window.DHD_SITE_INDEX)
        ? window.DHD_SITE_INDEX
        : [];
    state.catalogByPath = new Map();

    state.catalog.forEach(function (entry) {
      if (entry && entry.path) {
        state.catalogByPath.set(keyPath(entry.path), entry);
      }
    });
  }

  function fetchDoc(entry) {
    if (!entry || !entry.doc) {
      return Promise.resolve(null);
    }

    if (DOC_CACHE.has(entry.doc)) {
      return Promise.resolve(DOC_CACHE.get(entry.doc));
    }

    var url = new URL("assets/dhd-docs/" + encodeURIComponent(entry.doc) + ".json", state.root).href;

    return fetch(url, { cache: "default" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Documento nao encontrado: " + entry.path);
        }

        return response.json();
      })
      .then(function (doc) {
        DOC_CACHE.set(entry.doc, doc);
        return doc;
      })
      .catch(function () {
        return null;
      });
  }

  function renderLoading() {
    clear(state.elements.view);
    state.elements.view.appendChild(createElement("p", "dhd-empty", "Carregando documento..."));
  }

  function renderError(entry) {
    clear(state.elements.view);
    var box = createElement("section", "dhd-doc-head");
    box.appendChild(createElement("h1", "", entry ? entry.title : "Documento não encontrado"));
    box.appendChild(createElement("p", "", "A página existe no acervo, mas o documento estruturado ainda não foi carregado."));
    state.elements.view.appendChild(box);
  }

  function loadPage(path, query) {
    state.path = path || currentPathFromLocation();
    var entry = findEntry(state.path);

    renderLoading();
    renderCatalogList(null);

    return fetchDoc(entry).then(function (doc) {
      state.doc = doc;

      if (!doc) {
        renderError(entry);
      renderToc(null);
        return;
      }

      document.title = doc.title || "DireitoHD";

      if (keyPath(doc.path) === "index.html") {
        renderHome(doc);
      } else {
        renderDocument(doc);
      }

      renderToc(doc);
      document.body.classList.remove("dhd-toc-open");
      var nextQuery = typeof query === "string" ? query : new URLSearchParams(window.location.search).get("q") || "";
      state.elements.search.value = nextQuery;
      performSearch(nextQuery, false);
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  function navigateTo(path, query) {
    var next = hrefFor(path, query || "");

    history.pushState({ path: path, query: query || "" }, "", next);
    loadPage(path, query || "");
  }

  function renderHome(doc) {
    clear(state.elements.view);
    document.body.classList.add("dhd-home");
    document.body.classList.remove("dhd-document-page");

    var hero = createElement("section", "dhd-home-panel");
    var heroText = createElement("div", "dhd-home-text");
    var heroVisual = createElement("figure", "dhd-home-visual");
    var heroImage = createElement("img", "");
    heroImage.src = new URL("assets/dhd-hero-legal-research.png", state.root).href;
    heroImage.alt = "Mesa de pesquisa jurídica com livros e busca digital";
    heroImage.loading = "eager";
    heroText.appendChild(createElement("p", "dhd-kicker", "Vade Mecum DireitoHD"));
    heroText.appendChild(createElement("h1", "", "Acervo jurídico pesquisável"));
    heroText.appendChild(createElement("p", "dhd-home-copy", "Leis, códigos, súmulas e atos normativos em uma leitura limpa, com busca por lei, artigo, inciso, alínea e palavra-chave."));

    var stats = createElement("div", "dhd-stat-row");
    stats.appendChild(statItem(String(state.catalog.length), "páginas"));
    stats.appendChild(statItem(String(state.catalog.reduce(function (sum, item) { return sum + ((item.stats && item.stats.articles) || 0); }, 0)), "artigos"));
    stats.appendChild(statItem(String(state.catalog.filter(function (item) { return item.kind === "lei"; }).length), "leis"));
    heroText.appendChild(stats);
    heroVisual.appendChild(heroImage);
    hero.appendChild(heroText);
    hero.appendChild(heroVisual);
    state.elements.view.appendChild(hero);

    var quick = createElement("section", "dhd-section");
    quick.appendChild(createElement("h2", "dhd-section-title", "Acesso rápido"));
    var grid = createElement("div", "dhd-quick-grid");
    [
      ["Vade Mecum", "vademecumonline.html"],
      ["Constituição Federal", "cf88.html"],
      ["Código Penal", "cp-v1.html"],
      ["Código de Processo Penal", "cpp-v1.html"],
      ["Lei de Drogas", "lei11343.html"],
      ["Lei Maria da Penha", "leimariadapenha11340.html"],
      ["Código Civil", "codigo-civil-ncc.html"],
      ["CPC 2015", "codigodeprocessocivil-cpc2015.html"],
      ["Súmulas STF", "sumulasdostf.html"],
    ].forEach(function (item) {
      var entry = findEntry(item[1]);
      if (!entry) return;

      var link = createElement("a", "dhd-quick-link");
      link.dataset.kind = entry.kind || "pagina";
      link.href = hrefFor(entry.path);
      link.appendChild(createElement("strong", "", item[0]));
      link.appendChild(createElement("span", "", kindLabel(entry.kind)));
      grid.appendChild(link);
    });
    quick.appendChild(grid);
    state.elements.view.appendChild(quick);

    renderCatalogHub();
  }

  function statItem(value, label) {
    var item = createElement("span", "dhd-stat");
    item.appendChild(createElement("strong", "", value));
    item.appendChild(createElement("span", "", label));
    return item;
  }

  function renderCatalogHub() {
    var section = createElement("section", "dhd-section");
    section.appendChild(createElement("h2", "dhd-section-title", "Acervo"));
    var list = createElement("div", "dhd-hub-list");

    state.catalog
      .filter(function (entry) {
        return entry.stats && (entry.stats.blocks > 6 || entry.stats.links > 4);
      })
      .slice()
      .sort(function (a, b) {
        return (b.stats.articles || 0) - (a.stats.articles || 0) || a.title.localeCompare(b.title, "pt-BR");
      })
      .slice(0, 48)
      .forEach(function (entry) {
        list.appendChild(catalogLink(entry, "dhd-hub-link"));
      });

    section.appendChild(list);
    state.elements.view.appendChild(section);
  }

  function renderDocument(doc) {
    clear(state.elements.view);
    document.body.classList.remove("dhd-home");
    document.body.classList.add("dhd-document-page");

    var head = createElement("header", "dhd-doc-head");
    var docVisual = createElement("div", "dhd-doc-visual");
    var docVisualImage = createElement("img", "");
    docVisualImage.src = new URL("assets/dhd-hero-legal-research.png", state.root).href;
    docVisualImage.alt = "";
    docVisualImage.loading = "lazy";
    docVisualImage.setAttribute("aria-hidden", "true");
    docVisual.appendChild(docVisualImage);
    head.appendChild(createElement("p", "dhd-kicker", kindLabel(doc.kind)));
    head.appendChild(createElement("h1", "", doc.title || "Documento"));

    if (doc.description) {
      head.appendChild(createElement("p", "dhd-doc-desc", doc.description));
    }

    var stats = createElement("div", "dhd-doc-stats");
    stats.appendChild(createElement("span", "", (doc.stats && doc.stats.blocks || 0) + " blocos"));
    stats.appendChild(createElement("span", "", (doc.stats && doc.stats.articles || 0) + " artigos"));
    stats.appendChild(createElement("span", "", (doc.stats && doc.stats.links || 0) + " links"));
    head.appendChild(stats);
    head.appendChild(docVisual);

    var tools = createElement("div", "dhd-doc-tools");
    var annotationButton = createElement("button", "dhd-tool-button", state.showAnnotations ? "Notas visíveis" : "Notas ocultas");
    var compactButton = createElement("button", "dhd-tool-button", state.compactMode ? "Confortável" : "Compacto");
    annotationButton.type = "button";
    compactButton.type = "button";
    annotationButton.addEventListener("click", function () {
      state.showAnnotations = !state.showAnnotations;
      document.body.classList.toggle("dhd-hide-annotations", !state.showAnnotations);
      annotationButton.textContent = state.showAnnotations ? "Notas visíveis" : "Notas ocultas";
    });
    compactButton.addEventListener("click", function () {
      state.compactMode = !state.compactMode;
      document.body.classList.toggle("dhd-compact", state.compactMode);
      compactButton.textContent = state.compactMode ? "Confortável" : "Compacto";
    });
    tools.appendChild(annotationButton);
    tools.appendChild(compactButton);
    head.appendChild(tools);
    state.elements.view.appendChild(head);

    var reader = createElement("article", "dhd-reader");
    var currentArticle = null;
    var currentBody = null;

    (doc.blocks || []).forEach(function (block) {
      if (block.kind === "heading") {
        currentArticle = null;
        currentBody = null;
        reader.appendChild(blockElement(block, "heading"));
        return;
      }

      if (block.kind === "article") {
        currentArticle = createElement("section", "dhd-law-card");
        currentArticle.dataset.article = block.article || "";
        currentArticle.appendChild(blockElement(block, "article"));
        currentBody = createElement("div", "dhd-law-body");
        currentArticle.appendChild(currentBody);
        reader.appendChild(currentArticle);
        return;
      }

      if (currentArticle && currentBody && block.contextArticle === currentArticle.dataset.article) {
        currentBody.appendChild(blockElement(block, block.kind));
        return;
      }

      reader.appendChild(blockElement(block, block.kind));
    });

    state.elements.view.appendChild(reader);
    document.body.classList.toggle("dhd-hide-annotations", !state.showAnnotations);
    document.body.classList.toggle("dhd-compact", state.compactMode);
  }

  function blockElement(block, role) {
    var tag = role === "heading" ? "h2" : "p";
    var element = createElement(tag, "dhd-block dhd-block-" + role);

    element.id = block.id;
    element.dataset.kind = block.kind || "";
    if (block.article) element.dataset.article = block.article;
    if (block.contextArticle) element.dataset.contextArticle = block.contextArticle;
    if (block.inciso) element.dataset.inciso = block.inciso;
    if (block.alinea) element.dataset.alinea = block.alinea;
    element.innerHTML = block.html || escapeHtml(block.text);

    return element;
  }

  function renderToc(doc) {
    var panel = state.elements.toc;
    clear(panel);

    if (!doc) {
      panel.appendChild(createElement("h2", "dhd-side-title", "Índice"));
      panel.appendChild(createElement("p", "dhd-empty", "Sem documento."));
      return;
    }

    if (isHomePath(doc.path)) {
      panel.appendChild(createElement("h2", "dhd-side-title", "Acesso rápido"));
      var quick = createElement("div", "dhd-doc-links");
      [
        ["Vade Mecum On-line", "vademecumonline.html"],
        ["Constituição Federal", "cf88.html"],
        ["Código Penal", "cp-v1.html"],
        ["Código de Processo Penal", "cpp-v1.html"],
        ["Lei de Drogas", "lei11343.html"],
        ["Súmulas STF", "sumulasdostf.html"],
        ["Mapa do site", "mapadosite.html"],
      ].forEach(function (item) {
        var entry = findEntry(item[1]);
        if (!entry) return;
        var link = createElement("a", "", item[0]);
        link.href = hrefFor(entry.path);
        quick.appendChild(link);
      });
      panel.appendChild(quick);
      return;
    }

    panel.appendChild(createElement("h2", "dhd-side-title", "Índice"));

    if (!doc.toc || !doc.toc.length) {
      var links = createElement("div", "dhd-doc-links");
      (doc.links || []).slice(0, 80).forEach(function (link) {
        var anchor = createElement("a", "", link.text);
        anchor.href = link.href;
        links.appendChild(anchor);
      });
      panel.appendChild(links);
      return;
    }

    var nav = createElement("nav", "dhd-toc");
    nav.setAttribute("aria-label", "Índice do documento");
    doc.toc.slice(0, ARTICLE_LIMIT).forEach(function (item) {
      var link = createElement("a", item.kind === "article" ? "dhd-toc-article" : "dhd-toc-heading", item.label);
      link.href = "#" + item.id;
      link.addEventListener("click", function (event) {
        event.preventDefault();
        scrollToBlock(item.id);
      });
      nav.appendChild(link);
    });
    panel.appendChild(nav);

    if (doc.toc.length > ARTICLE_LIMIT) {
      panel.appendChild(createElement("p", "dhd-side-note", doc.toc.length + " itens no índice"));
    }
  }

  function catalogLink(entry, className) {
    var link = createElement("a", className || "dhd-catalog-link");
    link.dataset.kind = entry.kind || "pagina";
    link.href = hrefFor(entry.path);
    link.appendChild(createElement("strong", "", entry.title));
    var meta = createElement("span", "", kindLabel(entry.kind) + " | " + ((entry.stats && entry.stats.articles) || 0) + " artigos");
    link.appendChild(meta);
    return link;
  }

  function renderCatalogList(overrideEntries) {
    var list = state.elements.catalogList;
    if (!list) return;

    clear(list);

    var entries = overrideEntries || state.catalog.filter(function (entry) {
      return state.kindFilter === "todos" || entry.kind === state.kindFilter;
    });

    entries
      .slice()
      .sort(function (a, b) {
        if (overrideEntries) return (b.score || 0) - (a.score || 0);
        return a.title.localeCompare(b.title, "pt-BR");
      })
      .slice(0, 120)
      .forEach(function (entry) {
        list.appendChild(catalogLink(entry));
      });
  }

  function renderKindFilters() {
    var holder = state.elements.filters;
    clear(holder);

    [
      ["todos", "Todos"],
      ["lei", "Leis"],
      ["codigo", "Códigos"],
      ["decreto", "Decretos"],
      ["sumula", "Súmulas"],
      ["resolucao", "Resoluções"],
    ].forEach(function (filter) {
      var button = createElement("button", "dhd-filter", filter[1]);
      button.type = "button";
      button.setAttribute("aria-pressed", state.kindFilter === filter[0] ? "true" : "false");
      button.addEventListener("click", function () {
        state.kindFilter = filter[0];
        renderKindFilters();
        renderCatalogList(null);
      });
      holder.appendChild(button);
    });
  }

  function createToolbar() {
    var toolbar = createElement("header", "dhd-topbar");
    toolbar.id = "dhd-topbar";
    var inner = createElement("div", "dhd-topbar-inner");
    var brand = createElement("a", "dhd-brand", "DireitoHD");
    var form = createElement("form", "dhd-search-form");
    var input = createElement("input", "");
    var submit = createElement("button", "dhd-primary", "Buscar");
    var count = createElement("span", "dhd-count", "Acervo");
    var indexButton = createElement("button", "dhd-secondary", "Índice");
    var acervo = createElement("a", "dhd-secondary", "Acervo");

    brand.href = hrefFor("index.html");
    input.id = "dhd-search";
    input.type = "search";
    input.autocomplete = "off";
    input.placeholder = "Buscar lei, art. 28, inciso II, alínea b...";
    submit.type = "submit";
    indexButton.type = "button";
    acervo.href = hrefFor("vademecumonline.html");

    form.appendChild(input);
    form.appendChild(submit);
    inner.appendChild(brand);
    inner.appendChild(form);
    inner.appendChild(count);
    inner.appendChild(indexButton);
    inner.appendChild(acervo);
    toolbar.appendChild(inner);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      performSearch(input.value, true);
    });

    input.addEventListener("input", function () {
      window.clearTimeout(state.queryTimer);
      state.queryTimer = window.setTimeout(function () {
        performSearch(input.value, false);
      }, 120);
    });

    indexButton.addEventListener("click", function () {
      if (state.doc && !isHomePath(state.doc.path)) {
        document.body.classList.remove("dhd-sidebar-open");
        document.body.classList.toggle("dhd-toc-open");
        if (document.body.classList.contains("dhd-toc-open")) {
          state.elements.toc.scrollIntoView({ block: "start", behavior: "smooth" });
        }
        return;
      }

      document.body.classList.remove("dhd-toc-open");
      document.body.classList.toggle("dhd-sidebar-open");
    });

    state.elements.search = input;
    state.elements.count = count;
    document.body.insertBefore(toolbar, document.body.firstChild);
  }

  function createApp() {
    var app = createElement("div", "dhd-app");
    app.id = "dhd-app";
    var sidebar = createElement("aside", "dhd-sidebar");
    var sideHead = createElement("div", "dhd-side-head");
    var filters = createElement("div", "dhd-filters");
    var catalogList = createElement("div", "dhd-catalog-list");
    var main = createElement("main", "dhd-main");
    var results = createElement("section", "dhd-results");
    var view = createElement("div", "dhd-view");
    var toc = createElement("aside", "dhd-toc-panel");

    sideHead.appendChild(createElement("h2", "dhd-side-title", "Acervo"));
    sidebar.appendChild(sideHead);
    sidebar.appendChild(filters);
    sidebar.appendChild(catalogList);
    results.hidden = true;
    main.appendChild(results);
    main.appendChild(view);
    app.appendChild(sidebar);
    app.appendChild(main);
    app.appendChild(toc);

    state.elements.filters = filters;
    state.elements.catalogList = catalogList;
    state.elements.results = results;
    state.elements.view = view;
    state.elements.toc = toc;

    var toolbar = document.getElementById("dhd-topbar");
    document.body.insertBefore(app, toolbar ? toolbar.nextSibling : document.body.firstChild);
  }

  function ensureViewport() {
    var viewport = document.querySelector('meta[name="viewport"]');

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.name = "viewport";
      document.head.appendChild(viewport);
    }

    viewport.setAttribute("content", "width=device-width, initial-scale=1");
  }

  function hideLegacyNodes() {
    Array.prototype.slice.call(document.body.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE && /google-site-verification/i.test(node.nodeValue || "")) {
        node.nodeValue = "";
      }
    });
  }

  function interceptInternalNavigation() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href]");

      if (!link || link.target === "_blank" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      var path = pathFromHref(link.href);
      if (!path || !findEntry(path)) {
        return;
      }

      event.preventDefault();
      var query = new URL(link.href).searchParams.get("q") || "";
      navigateTo(path, query);
    });

    window.addEventListener("popstate", function () {
      loadPage(currentPathFromLocation(), new URLSearchParams(window.location.search).get("q") || "");
    });
  }

  ready(function () {
    state.root = findSiteRoot();
    ensureViewport();
    hideLegacyNodes();
    loadCatalog();
    document.documentElement.classList.add("dhd-active");
    document.body.classList.add("dhd-enhanced");
    createToolbar();
    createApp();
    renderKindFilters();
    renderCatalogList(null);
    interceptInternalNavigation();
    loadPage(currentPathFromLocation(), new URLSearchParams(window.location.search).get("q") || "");
  });
}());
