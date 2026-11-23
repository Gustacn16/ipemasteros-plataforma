import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HREF_SEM_DOCUMENTO } from "../regras/ligacoes";
import { ancoraDoTitulo, textoSemMarcacao } from "../regras/sumario";

/** Só http, https, mailto e caminhos relativos; outros esquemas (javascript:, data:) viram vazio. */
function urlSegura(url: string): string {
  const t = url.trim();
  if (/^(https?:|mailto:)/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return "";
  return t;
}

/** Texto puro dos filhos de um título, para gerar a âncora igual à do sumário. */
function textoDe(no: ReactNode): string {
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join("");
  if (isValidElement<{ children?: ReactNode }>(no)) return textoDe(no.props.children);
  return "";
}
const ancora = (filhos: ReactNode) => ancoraDoTitulo(textoSemMarcacao(textoDe(filhos)));

function limpar<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node, ...resto } = props;
  void node;
  return resto;
}

/** Texto do documento em Markdown, sem HTML cru. `[[Título]]` já chega trocado por link. */
export function TextoProcesso({ texto }: { texto: string }) {
  return (
    <div className="text-foreground/90 max-w-3xl text-[0.95rem] leading-7">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlSegura}
        components={{
          img: () => null,
          h1: (p) => <h2 id={ancora(p.children)} className="text-foreground mt-8 mb-3 scroll-mt-6 text-xl font-semibold tracking-tight first:mt-0" {...limpar(p)} />,
          h2: (p) => <h2 id={ancora(p.children)} className="text-foreground mt-8 mb-3 scroll-mt-6 text-lg font-semibold tracking-tight first:mt-0" {...limpar(p)} />,
          h3: (p) => <h3 id={ancora(p.children)} className="text-foreground mt-6 mb-2 scroll-mt-6 font-semibold first:mt-0" {...limpar(p)} />,
          p: (p) => <p className="my-3 first:mt-0 last:mb-0" {...limpar(p)} />,
          ul: (p) => <ul className="marker:text-primary my-3 list-disc space-y-1 pl-6" {...limpar(p)} />,
          ol: (p) => <ol className="marker:text-primary my-3 list-decimal space-y-1 pl-6 marker:font-semibold" {...limpar(p)} />,
          blockquote: (p) => <blockquote className="border-primary bg-primary/5 my-4 rounded-r-lg border-l-4 px-4 py-2" {...limpar(p)} />,
          hr: () => <hr className="my-6" />,
          code: (p) => <code className="bg-muted rounded px-1.5 py-0.5 text-[0.85em]" {...limpar(p)} />,
          table: (p) => (
            <div className="my-4 overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-sm" {...limpar(p)} />
            </div>
          ),
          th: (p) => <th className="bg-muted/60 border-b px-3 py-2 text-left font-medium" {...limpar(p)} />,
          td: (p) => <td className="border-b px-3 py-2 align-top" {...limpar(p)} />,
          a: ({ href = "", children }) => {
            if (href === HREF_SEM_DOCUMENTO) {
              return (
                <span title="Nenhum documento com esse título" className="text-muted-foreground border-muted-foreground/50 border-b border-dashed">
                  {children}
                </span>
              );
            }
            if (href === "#") {
              return <span className="text-primary font-medium underline decoration-primary/30 underline-offset-4">{children}</span>;
            }
            if (href.startsWith("/")) {
              return (
                <Link href={href} className="text-primary font-medium underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                {children}
              </a>
            );
          },
        }}
      >
        {texto}
      </Markdown>
    </div>
  );
}
