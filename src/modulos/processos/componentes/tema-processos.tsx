// Cor própria da área de Processos (verde-petróleo), no lugar do roxo.
// Vale enquanto o layout do módulo está na tela, inclusive em diálogos
// (que abrem fora da árvore do layout). O menu lateral usa --sidebar-*, não muda.
const CSS = `
:root, .tema-claro {
  --primary: #0f766e;
  --primary-foreground: #ffffff;
  --ring: #0f766e;
  --accent: #e3f3f1;
}
.dark {
  --primary: #2dd4bf;
  --primary-foreground: #042f2a;
  --ring: #2dd4bf;
  --accent: rgb(45 212 191 / 14%);
}
`;

export function TemaProcessos() {
  return <style>{CSS}</style>;
}
