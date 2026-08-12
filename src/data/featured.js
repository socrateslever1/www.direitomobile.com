export const featuredDocuments = {
  'cp-v2': {
    title: 'Código Penal — Parte Especial',
    subtitle: 'Decreto-Lei nº 2.848/1940',
    source: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
    updatedAt: 'Acervo local — conferência oficial pendente',
    articles: [
      {
        id: 'art-121-a',
        number: 'Art. 121-A',
        heading: 'Feminicídio',
        text: 'Matar mulher por razões da condição do sexo feminino.',
        penalty: 'Pena — reclusão, de 20 a 40 anos.',
        explanation: 'O feminicídio passou a ser crime autônomo. O dispositivo considera razões da condição do sexo feminino quando o fato envolve violência doméstica e familiar ou menosprezo ou discriminação à condição de mulher.',
        topics: ['Feminicídio', 'Violência contra a mulher', 'Tribunal do Júri'],
        related: ['Lei nº 14.994/2024', 'Lei nº 8.072/1990', 'Lei nº 11.340/2006'],
      },
      {
        id: 'art-129-13',
        number: 'Art. 129, § 13',
        heading: 'Lesão corporal contra a mulher',
        text: 'Se a lesão é praticada contra a mulher, por razões da condição do sexo feminino, nos termos do § 1º do art. 121-A deste Código.',
        penalty: 'Pena — reclusão, de 2 a 5 anos.',
        explanation: 'O dispositivo qualifica a lesão corporal cometida contra a mulher pelas razões previstas no artigo 121-A.',
        topics: ['Violência contra a mulher', 'Lesão corporal'],
        related: ['Art. 121-A do Código Penal', 'Lei nº 11.340/2006'],
      },
    ],
  },
  leimariadapenha11340: {
    title: 'Lei Maria da Penha',
    subtitle: 'Lei nº 11.340/2006',
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm',
    updatedAt: 'Acervo local — conferência oficial pendente',
    articles: [
      {
        id: 'art-5',
        number: 'Art. 5º',
        heading: 'Violência doméstica e familiar',
        text: 'Configura violência doméstica e familiar contra a mulher qualquer ação ou omissão baseada no gênero que lhe cause morte, lesão, sofrimento físico, sexual ou psicológico e dano moral ou patrimonial.',
        explanation: 'O artigo delimita o conceito e os ambientes nos quais a violência pode ocorrer: unidade doméstica, família e relação íntima de afeto.',
        topics: ['Feminicídio', 'Violência doméstica', 'Proteção da mulher'],
        related: ['Art. 121-A do Código Penal', 'Lei nº 14.541/2023'],
      },
      {
        id: 'art-7',
        number: 'Art. 7º',
        heading: 'Formas de violência',
        text: 'São formas de violência doméstica e familiar contra a mulher, entre outras: a violência física, psicológica, sexual, patrimonial e moral.',
        explanation: 'As cinco formas podem ocorrer simultaneamente e não dependem necessariamente de agressão física.',
        topics: ['Violência doméstica', 'Proteção da mulher'],
        related: ['Medidas protetivas de urgência'],
      },
    ],
  },
  lei8072: {
    title: 'Lei dos Crimes Hediondos',
    subtitle: 'Lei nº 8.072/1990',
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm',
    updatedAt: 'Acervo local — conferência oficial pendente',
    articles: [
      {
        id: 'art-1',
        number: 'Art. 1º',
        heading: 'Crimes considerados hediondos',
        text: 'São considerados hediondos os crimes relacionados no dispositivo, consumados ou tentados, entre eles o feminicídio previsto no art. 121-A do Código Penal.',
        explanation: 'A classificação como hediondo produz consequências penais e processuais específicas estabelecidas na legislação.',
        topics: ['Feminicídio', 'Crimes hediondos'],
        related: ['Art. 121-A do Código Penal', 'Lei nº 14.994/2024'],
      },
    ],
  },
  lei14541: {
    title: 'Delegacias Especializadas de Atendimento à Mulher',
    subtitle: 'Lei nº 14.541/2023',
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14541.htm',
    updatedAt: 'Numeração corrigida a partir do conteúdo do acervo',
    articles: [
      {
        id: 'art-3',
        number: 'Art. 3º',
        heading: 'Finalidade e funcionamento',
        text: 'As Delegacias Especializadas de Atendimento à Mulher têm como finalidade atender mulheres vítimas de violência doméstica e familiar, crimes contra a dignidade sexual e feminicídios, e funcionarão ininterruptamente.',
        explanation: 'O artigo também prevê sala reservada, preferência por atendimento feito por policiais do sexo feminino e treinamento adequado.',
        topics: ['Feminicídio', 'Violência doméstica', 'Atendimento policial'],
        related: ['Lei nº 11.340/2006'],
      },
    ],
  },
}

export const legalTopics = [
  {
    id: 'feminicidio',
    name: 'Feminicídio',
    description: 'Crime autônomo, proteção da mulher, atendimento especializado e consequências penais.',
    color: '#b33b56',
    documents: ['cp-v2', 'leimariadapenha11340', 'lei8072', 'lei14541'],
  },
  {
    id: 'violencia-domestica',
    name: 'Violência doméstica',
    description: 'Conceitos, formas de violência, medidas de proteção e rede de atendimento.',
    color: '#7b4ea3',
    documents: ['leimariadapenha11340', 'cp-v2', 'lei14541'],
  },
  {
    id: 'seguranca-publica',
    name: 'Segurança pública',
    description: 'Normas sobre atuação estatal, investigação, polícia e proteção de direitos.',
    color: '#236e61',
    documents: [],
  },
]
