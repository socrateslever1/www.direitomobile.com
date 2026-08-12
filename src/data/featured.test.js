import { describe, expect, it } from 'vitest'
import catalog from './catalog.generated.json'
import { featuredDocuments, legalTopics } from './featured.js'

describe('acervo jurídico', () => {
  it('mantém um catálogo amplo gerado do repositório', () => {
    expect(catalog.length).toBeGreaterThan(400)
  })

  it('liga o tema feminicídio a documentos e dispositivos', () => {
    const topic = legalTopics.find((item) => item.id === 'feminicidio')
    expect(topic.documents.length).toBeGreaterThanOrEqual(4)
    for (const id of topic.documents) {
      expect(featuredDocuments[id]).toBeDefined()
      expect(featuredDocuments[id].articles.some((article) => article.topics.includes('Feminicídio'))).toBe(true)
    }
  })
})
