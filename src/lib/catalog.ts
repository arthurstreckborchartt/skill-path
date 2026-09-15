import type { AreaId, SkillLevel } from "@/lib/onboarding";

/**
 * Catálogo de conteúdo real. Cada item aponta para material que existe e está no ar.
 *
 * Regra de licença (ver supabase/FONTES-DE-CONTEUDO.md): o link e os fatos (título, canal,
 * provedor) não são protegidos, mas o texto curado de terceiros é. Então `summary` é sempre
 * escrito por nós, nunca copiado da fonte. Nada aqui é conteúdo redistribuído.
 *
 * Este arquivo é a fonte de verdade do catálogo e também o que alimenta a tabela `resources`
 * do Supabase (ver supabase/seed-catalogo.sql, gerado a partir daqui).
 */
export type ResourceKind = "curso" | "video" | "artigo" | "doc" | "livro" | "projeto";

export type CatalogResource = {
  slug: string;
  title: string;
  url: string;
  kind: ResourceKind;
  provider: string;
  language: "pt" | "en";
  isFree: boolean;
  /** assuntos que este material cobre — casam com `skills` das etapas */
  topics: string[];
  areas: AreaId[];
  level?: SkillLevel;
  /** descrição nossa, em uma linha */
  summary: string;
};

export const CATALOG: CatalogResource[] = [
  /* ---------------- fundamentos de programação ---------------- */
  {
    slug: "curso-em-video-python",
    title: "Curso de Python — Curso em Vídeo",
    url: "https://www.youtube.com/playlist?list=PLHz_AreHm4dlKP6QQCekuIPky1CiwmdI6",
    kind: "video",
    provider: "Curso em Vídeo",
    language: "pt",
    isFree: true,
    topics: ["Python", "Lógica"],
    areas: ["tech", "data", "ai"],
    level: "iniciante",
    summary:
      "Python do zero em português, com exercícios a cada aula. É o caminho mais usado por quem começa no Brasil.",
  },
  {
    slug: "freecodecamp-python",
    title: "Scientific Computing with Python",
    url: "https://www.freecodecamp.org/learn/scientific-computing-with-python/",
    kind: "curso",
    provider: "freeCodeCamp",
    language: "en",
    isFree: true,
    topics: ["Python", "Lógica"],
    areas: ["tech", "data", "ai"],
    level: "iniciante",
    summary:
      "Certificação gratuita com projetos obrigatórios no fim — bom para provar que você aprendeu, não só assistiu.",
  },
  {
    slug: "python-docs-tutorial",
    title: "Tutorial oficial do Python",
    url: "https://docs.python.org/pt-br/3/tutorial/",
    kind: "doc",
    provider: "Python Software Foundation",
    language: "pt",
    isFree: true,
    topics: ["Python"],
    areas: ["tech", "data", "ai"],
    summary:
      "A documentação oficial traduzida. Serve de consulta quando o vídeo não explica o detalhe.",
  },

  /* ---------------- versionamento ---------------- */
  {
    slug: "pro-git-livro",
    title: "Pro Git (livro completo)",
    url: "https://git-scm.com/book/pt-br/v2",
    kind: "livro",
    provider: "git-scm",
    language: "pt",
    isFree: true,
    topics: ["Git", "Git básico", "Git avançado"],
    areas: ["tech", "data", "ai"],
    summary:
      "O livro de referência de Git, gratuito e em português. Os três primeiros capítulos já cobrem o dia a dia.",
  },
  {
    slug: "github-skills",
    title: "GitHub Skills",
    url: "https://skills.github.com/",
    kind: "curso",
    provider: "GitHub",
    language: "en",
    isFree: true,
    topics: ["Git", "Git básico", "README"],
    areas: ["tech", "data", "design", "ai"],
    level: "iniciante",
    summary:
      "Exercícios práticos dentro do próprio GitHub: você aprende abrindo pull request de verdade.",
  },

  /* ---------------- back-end e APIs ---------------- */
  {
    slug: "fastapi-docs",
    title: "Documentação do FastAPI",
    url: "https://fastapi.tiangolo.com/pt/",
    kind: "doc",
    provider: "FastAPI",
    language: "pt",
    isFree: true,
    topics: ["FastAPI", "REST", "HTTP"],
    areas: ["tech", "ai"],
    level: "intermediário",
    summary:
      "Tutorial oficial em português, do primeiro endpoint até autenticação. É documentação e curso ao mesmo tempo.",
  },
  {
    slug: "mdn-http",
    title: "HTTP — MDN Web Docs",
    url: "https://developer.mozilla.org/pt-BR/docs/Web/HTTP",
    kind: "doc",
    provider: "MDN",
    language: "pt",
    isFree: true,
    topics: ["HTTP", "REST"],
    areas: ["tech"],
    summary:
      "Referência de métodos, status e cabeçalhos HTTP. É o que você vai consultar em toda entrevista técnica.",
  },
  {
    slug: "freecodecamp-backend",
    title: "Back End Development and APIs",
    url: "https://www.freecodecamp.org/learn/back-end-development-and-apis/",
    kind: "curso",
    provider: "freeCodeCamp",
    language: "en",
    isFree: true,
    topics: ["REST", "Node.js", "HTTP"],
    areas: ["tech"],
    level: "intermediário",
    summary: "Cinco APIs construídas do zero, com certificação no fim. Vira portfólio direto.",
  },

  /* ---------------- banco de dados ---------------- */
  {
    slug: "sqlbolt",
    title: "SQLBolt — exercícios interativos",
    url: "https://sqlbolt.com/",
    kind: "curso",
    provider: "SQLBolt",
    language: "en",
    isFree: true,
    topics: ["SQL", "Joins e agregações"],
    areas: ["tech", "data"],
    level: "iniciante",
    summary:
      "Você escreve SQL no navegador e vê o resultado na hora. Cobre join e agregação em uma tarde.",
  },
  {
    slug: "postgres-tutorial",
    title: "PostgreSQL Tutorial",
    url: "https://neon.com/postgresql/tutorial",
    kind: "curso",
    provider: "PostgreSQL Tutorial",
    language: "en",
    isFree: true,
    topics: ["PostgreSQL", "SQL", "Modelagem"],
    areas: ["tech", "data"],
    level: "intermediário",
    summary: "Do básico a índices e performance, com base de exemplo para praticar.",
  },
  {
    slug: "freecodecamp-relational-db",
    title: "Relational Database",
    url: "https://www.freecodecamp.org/learn/relational-database/",
    kind: "curso",
    provider: "freeCodeCamp",
    language: "en",
    isFree: true,
    topics: ["SQL", "PostgreSQL", "Modelagem"],
    areas: ["tech", "data"],
    level: "intermediário",
    summary:
      "Banco relacional direto no terminal, com Postgres e Git. Mais próximo do trabalho real que exercício de tela.",
  },

  /* ---------------- containers e entrega ---------------- */
  {
    slug: "docker-get-started",
    title: "Docker — Get Started",
    url: "https://docs.docker.com/get-started/",
    kind: "doc",
    provider: "Docker",
    language: "en",
    isFree: true,
    topics: ["Docker", "CI/CD"],
    areas: ["tech", "data"],
    level: "avançado",
    summary: "Guia oficial: da primeira imagem até subir uma aplicação com vários serviços.",
  },
  {
    slug: "github-actions-docs",
    title: "GitHub Actions — documentação",
    url: "https://docs.github.com/pt/actions",
    kind: "doc",
    provider: "GitHub",
    language: "pt",
    isFree: true,
    topics: ["CI/CD", "Pipeline de CI"],
    areas: ["tech", "data"],
    level: "avançado",
    summary:
      "CI gratuito para repositório público. É o caminho mais curto para ter pipeline no portfólio.",
  },

  /* ---------------- dados ---------------- */
  {
    slug: "kaggle-learn",
    title: "Kaggle Learn",
    url: "https://www.kaggle.com/learn",
    kind: "curso",
    provider: "Kaggle",
    language: "en",
    isFree: true,
    topics: ["Pandas", "Python", "Machine Learning", "Análise de dados"],
    areas: ["data", "ai"],
    level: "intermediário",
    summary:
      "Módulos curtos com notebook rodando no navegador, sem instalar nada. Pandas e SQL em poucas horas.",
  },
  {
    slug: "pandas-getting-started",
    title: "Pandas — guia de introdução",
    url: "https://pandas.pydata.org/docs/getting_started/index.html",
    kind: "doc",
    provider: "pandas",
    language: "en",
    isFree: true,
    topics: ["Pandas", "Tratamento de dados"],
    areas: ["data", "ai"],
    summary: "Documentação oficial com comparações para quem vem do Excel e do SQL.",
  },
  {
    slug: "freecodecamp-data-analysis",
    title: "Data Analysis with Python",
    url: "https://www.freecodecamp.org/learn/data-analysis-with-python/",
    kind: "curso",
    provider: "freeCodeCamp",
    language: "en",
    isFree: true,
    topics: ["Pandas", "Python", "Análise de dados"],
    areas: ["data"],
    level: "intermediário",
    summary: "Análise com pandas e numpy, terminando em cinco projetos avaliados.",
  },
  {
    slug: "power-bi-learn",
    title: "Microsoft Learn — Power BI",
    url: "https://learn.microsoft.com/pt-br/training/powerplatform/power-bi",
    kind: "curso",
    provider: "Microsoft",
    language: "pt",
    isFree: true,
    topics: ["Power BI", "Storytelling de dados", "Excel avançado"],
    areas: ["data", "finance", "admin"],
    level: "iniciante",
    summary: "Trilha oficial em português, do primeiro relatório ao painel publicado.",
  },

  /* ---------------- design ---------------- */
  {
    slug: "figma-learn",
    title: "Figma — Learn Design",
    url: "https://www.figma.com/resource-library/",
    kind: "curso",
    provider: "Figma",
    language: "en",
    isFree: true,
    topics: ["Figma básico", "Figma avançado", "UI Design"],
    areas: ["design"],
    level: "iniciante",
    summary: "Material da própria Figma sobre fundamentos de interface e uso da ferramenta.",
  },
  {
    slug: "laws-of-ux",
    title: "Laws of UX",
    url: "https://lawsofux.com/",
    kind: "artigo",
    provider: "Laws of UX",
    language: "pt",
    isFree: true,
    topics: ["UX", "Hierarquia visual", "Pesquisa com usuários"],
    areas: ["design"],
    summary:
      "Princípios de usabilidade explicados em uma página cada, em português. Dá vocabulário para justificar decisão de tela.",
  },
  {
    slug: "material-design",
    title: "Material Design 3",
    url: "https://m3.material.io/",
    kind: "doc",
    provider: "Google",
    language: "en",
    isFree: true,
    topics: ["Design system", "Componentização", "Tokens de cor e espaçamento"],
    areas: ["design"],
    level: "intermediário",
    summary: "Design system completo e público — serve de referência de como documentar o seu.",
  },

  /* ---------------- marketing ---------------- */
  {
    slug: "google-skillshop",
    title: "Google Skillshop",
    url: "https://skillshop.withgoogle.com/",
    kind: "curso",
    provider: "Google",
    language: "pt",
    isFree: true,
    topics: ["Tráfego pago", "Google Analytics", "Métricas"],
    areas: ["marketing", "sales"],
    level: "iniciante",
    summary:
      "Certificações oficiais gratuitas de Ads e Analytics, reconhecidas em processo seletivo.",
  },
  {
    slug: "meta-blueprint",
    title: "Meta Blueprint",
    url: "https://www.facebook.com/business/learn",
    kind: "curso",
    provider: "Meta",
    language: "pt",
    isFree: true,
    topics: ["Meta Ads", "Tráfego pago", "Otimização de campanha"],
    areas: ["marketing", "sales"],
    level: "iniciante",
    summary:
      "Trilhas gratuitas de anúncios no Instagram e Facebook, direto de quem faz a plataforma.",
  },
  {
    slug: "google-analytics-academy",
    title: "Google Analytics — central de ajuda",
    url: "https://support.google.com/analytics/answer/9304153",
    kind: "doc",
    provider: "Google",
    language: "pt",
    isFree: true,
    topics: ["Google Analytics", "Leitura de dados", "Funil de marketing"],
    areas: ["marketing"],
    summary: "Como configurar e ler os relatórios do GA4, que é o que as vagas pedem hoje.",
  },

  /* ---------------- transversais ---------------- */
  {
    slug: "free-programming-books",
    title: "Free Programming Books (pt-BR)",
    url: "https://github.com/EbookFoundation/free-programming-books/blob/main/books/free-programming-books-pt_BR.md",
    kind: "livro",
    provider: "Ebook Foundation",
    language: "pt",
    isFree: true,
    topics: ["Python", "SQL", "Git", "Lógica", "JavaScript"],
    areas: ["tech", "data", "ai", "other"],
    summary:
      "Lista mantida pela comunidade com centenas de livros gratuitos em português, por linguagem.",
  },
  {
    slug: "roadmap-sh",
    title: "roadmap.sh",
    url: "https://roadmap.sh/",
    kind: "artigo",
    provider: "roadmap.sh",
    language: "en",
    isFree: true,
    topics: ["Posicionamento", "Lógica"],
    areas: ["tech", "data", "design", "ai"],
    summary: "Mapas visuais de carreira para comparar com a sua rota e ver o que vem depois.",
  },
  {
    slug: "grow-google",
    title: "Cresça com o Google",
    url: "https://grow.google/intl/pt-BR/",
    kind: "curso",
    provider: "Google",
    language: "pt",
    isFree: true,
    topics: ["Posicionamento", "LinkedIn otimizado", "Currículo revisado", "Entrevista"],
    areas: ["tech", "data", "design", "marketing", "sales", "admin", "other"],
    summary:
      "Trilhas gratuitas em português sobre currículo, entrevista e primeiros passos de carreira.",
  },
];

/**
 * Materiais que cobrem qualquer um dos assuntos. Prioriza a área da rota quando ela é conhecida,
 * e depois português — o público é brasileiro e material em inglês trava quem está começando.
 */
export function resourcesForTopics(topics: string[], area?: AreaId, limit = 3): CatalogResource[] {
  const wanted = topics.map((t) => t.toLowerCase());
  return CATALOG.filter((r) => r.topics.some((t) => wanted.includes(t.toLowerCase())))
    .sort((a, b) => {
      if (area) {
        const areaScore = Number(b.areas.includes(area)) - Number(a.areas.includes(area));
        if (areaScore !== 0) return areaScore;
      }
      return Number(b.language === "pt") - Number(a.language === "pt");
    })
    .slice(0, limit);
}
