CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Leitor',
  body TEXT NOT NULL CHECK (length(body) BETWEEN 3 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_article_status_created
  ON comments(article_id, status, created_at DESC);
