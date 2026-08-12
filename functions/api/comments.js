const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
})

export async function onRequestGet(context) {
  if (!context.env.DB) return json({ comments: [], setupRequired: true }, 503)
  const articleId = new URL(context.request.url).searchParams.get('articleId')?.trim()
  if (!articleId || articleId.length > 300) return json({ error: 'articleId inválido.' }, 400)

  try {
    const result = await context.env.DB.prepare(`
      SELECT id, article_id, author_name, body, created_at
      FROM comments
      WHERE article_id = ?1 AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(articleId).all()
    return json({ comments: result.results ?? [] })
  } catch (error) {
    console.error(JSON.stringify({ event: 'comments_list_failed', message: error instanceof Error ? error.message : 'unknown' }))
    return json({ error: 'Não foi possível carregar os comentários.' }, 500)
  }
}

export async function onRequestPost(context) {
  if (!context.env.DB) return json({ error: 'Banco D1 não configurado.', setupRequired: true }, 503)

  let input
  try { input = await context.request.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
  const articleId = typeof input.articleId === 'string' ? input.articleId.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const authorName = typeof input.authorName === 'string' ? input.authorName.trim().slice(0, 80) : 'Leitor'
  if (articleId.length < 3 || articleId.length > 300) return json({ error: 'articleId inválido.' }, 400)
  if (body.length < 3 || body.length > 1000) return json({ error: 'O comentário deve ter entre 3 e 1000 caracteres.' }, 400)

  const comment = {
    id: crypto.randomUUID(), article_id: articleId, author_name: authorName,
    body, created_at: new Date().toISOString(),
  }
  try {
    await context.env.DB.prepare(`
      INSERT INTO comments (id, article_id, author_name, body, status, created_at)
      VALUES (?1, ?2, ?3, ?4, 'approved', ?5)
    `).bind(comment.id, comment.article_id, comment.author_name, comment.body, comment.created_at).run()
    return json({ comment }, 201)
  } catch (error) {
    console.error(JSON.stringify({ event: 'comment_create_failed', message: error instanceof Error ? error.message : 'unknown' }))
    return json({ error: 'Não foi possível publicar o comentário.' }, 500)
  }
}
