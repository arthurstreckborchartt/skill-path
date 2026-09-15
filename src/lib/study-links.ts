/**
 * Buscas de estudo por etapa.
 *
 * O catálogo (`src/lib/catalog.ts`) é curado à mão e verificado um por um, o que o torna
 * confiável e pequeno: fora dos assuntos que ele cobre, a etapa ficava sem material nenhum e a
 * seção "Recursos de estudo" caía num rótulo que não era link — a pessoa clicava e não acontecia
 * nada. Este módulo garante que toda etapa, sempre, tenha para onde ir.
 *
 * São buscas, não recomendações: montamos a consulta a partir das habilidades da etapa e
 * mandamos a pessoa para a busca da plataforma. Ninguém aqui afirma que um curso específico é
 * bom — afirmar isso sem ter assistido seria inventar. O que é curadoria de verdade vem do
 * catálogo e aparece em primeiro lugar, separado destas buscas.
 *
 * Os endpoints abaixo são de busca pública e estáveis, sem chave de API. Quando a geração por IA
 * entrar, ela acrescenta itens ao catálogo — este módulo continua sendo o piso que garante que
 * nunca exista etapa sem caminho.
 */

export type TipoBusca = "grátis" | "pago";

export type BuscaEstudo = {
  id: string;
  provider: string;
  label: string;
  hint: string;
  url: string;
  tipo: TipoBusca;
};

/** Consulta curta: plataformas de busca degradam rápido com frases longas. */
function consulta(skills: string[], max = 3): string {
  const termos = skills.slice(0, max).join(" ");
  return termos.trim() || "tecnologia";
}

export function buscasParaEtapa(skills: string[]): BuscaEstudo[] {
  const q = consulta(skills);
  const enc = encodeURIComponent(q);
  const encCurso = encodeURIComponent(`curso ${q}`);

  return [
    {
      id: "youtube-aulas",
      provider: "YouTube",
      label: `Aulas de ${q}`,
      hint: "vídeos avulsos, do básico ao avançado",
      url: `https://www.youtube.com/results?search_query=${encCurso}`,
      tipo: "grátis",
    },
    {
      id: "youtube-playlists",
      provider: "YouTube",
      label: `Cursos completos de ${q}`,
      // sp=EgIQAw%3D%3D é o filtro de playlists do YouTube: é o que separa um curso inteiro
      // de um vídeo solto, e é a diferença entre estudar e ficar pulando de vídeo em vídeo.
      hint: "playlists inteiras, na ordem",
      url: `https://www.youtube.com/results?search_query=${encCurso}&sp=EgIQAw%3D%3D`,
      tipo: "grátis",
    },
    {
      id: "freecodecamp",
      provider: "freeCodeCamp",
      label: `Artigos e tutoriais de ${q}`,
      hint: "conteúdo gratuito, boa parte em português",
      url: `https://www.freecodecamp.org/portuguese/news/search?query=${enc}`,
      tipo: "grátis",
    },
    {
      id: "alura",
      provider: "Alura",
      label: `Formações de ${q}`,
      hint: "em português, com certificado",
      url: `https://www.alura.com.br/busca?query=${enc}`,
      tipo: "pago",
    },
    {
      id: "udemy",
      provider: "Udemy",
      label: `Cursos de ${q}`,
      hint: "compra avulsa, costuma ter promoção",
      url: `https://www.udemy.com/courses/search/?q=${enc}&lang=pt`,
      tipo: "pago",
    },
    {
      id: "coursera",
      provider: "Coursera",
      label: `Certificações de ${q}`,
      hint: "universidades e empresas; dá para assistir grátis sem certificado",
      url: `https://www.coursera.org/search?query=${enc}`,
      tipo: "pago",
    },
  ];
}
