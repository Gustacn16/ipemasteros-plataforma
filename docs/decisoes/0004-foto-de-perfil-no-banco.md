# 0004 — Foto de perfil guardada no banco

- **Status:** Aceito
- **Data:** 2026-11-02

## Contexto
O cadastro pelo convite passou a exigir uma foto de perfil. O disco do app na Hostinger é recriado a cada deploy, então a foto não pode ficar na pasta do app. O storage externo compatível com S3 (R2 ou Hostinger Object Storage) ainda não foi escolhido: essa decisão continua pendente para anexos e mídias de conteúdo.

## Decisão
A foto de perfil fica numa tabela própria, `fotos_usuarios` (`MEDIUMBLOB`), separada de `usuarios` para não pesar as consultas.
- O navegador recorta a foto em quadrado e a reduz para 400×400 em JPEG antes de enviar, ficando com uns 50 KB.
- O servidor aceita até 512 KB e confere o tipo real pelos primeiros bytes (JPEG, PNG ou WebP). SVG e outros formatos são recusados.
- A foto é servida por `/api/usuarios/[id]/foto`, só para quem está logado, com `Cache-Control: private`. `Usuario.imagem` guarda essa URL com `?v=<data>`, que muda a cada nova foto.

## Alternativas consideradas
- **Storage S3 agora:** depende de conta e chaves e da ADR de storage ainda em aberto. Bloquearia o cadastro por causa de uma imagem pequena.
- **Pasta do app ou `public/`:** os arquivos se perdem no deploy, e a foto ficaria pública.
- **Redimensionar no servidor (sharp):** depende de binário nativo, o que é arriscado com a glibc antiga do servidor (ver ADR 0002).

## Consequências
- Nenhuma configuração nova. Funciona igual em homologação e produção.
- Com poucas dezenas de usuários internos, o banco cresce alguns MB. Isto **não** vale para anexos e mídias de conteúdo, que continuam esperando a ADR de storage.
- Quando o storage existir, a migração é simples: copiar os blobs e trocar `Usuario.imagem`.
