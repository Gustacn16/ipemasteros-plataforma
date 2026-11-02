# 0005 — Cifra dos links de agenda pessoal

- **Status:** Aceito
- **Data:** 2026-11-02

## Contexto
Na entrega 2 da Agenda, cada pessoa cola o endereço secreto iCal do Google Agenda ou do Outlook para ver a agenda pessoal junto com a da IPEMaster. Quem tem esse link lê a agenda inteira da pessoa, então ele não pode ficar em claro no banco, em backups nem em log. O servidor precisa do link em claro para buscar o `.ics`, então um hash não serve: é preciso cifra reversível. O projeto ainda não tem um cofre de segredos, e cada variável de ambiente nova precisa ser criada à mão na Hostinger (homologação e produção).

## Decisão
- O link é guardado cifrado com **AES-256-GCM** (cifra autenticada: qualquer adulteração é detectada).
- A chave de 32 bytes é derivada de `BETTER_AUTH_SECRET` por **HKDF-SHA256**, com sal `ipemaster-agenda` e info `agenda-externa:v1`. O HKDF separa esta chave da que o Better Auth usa, mesmo vindo do mesmo segredo.
- Cada cifra usa um IV aleatório de 12 bytes. O texto guardado é `v1.<iv>.<tag>.<dados>`, em base64url. O `v1` permite trocar o esquema depois sem perder a leitura dos links antigos.
- Sem `BETTER_AUTH_SECRET`, cifrar e decifrar falham (erro de configuração). Se a decifra falhar, a pessoa vê "Este link precisa ser colado de novo."
- O código fica em `src/modulos/agenda/servicos/cifra.ts`, só no servidor. A tela mostra apenas o host e os últimos 6 caracteres do link.

## Alternativas consideradas
- **Variável nova (`AGENDA_CHAVE`):** isola melhor, mas é mais uma variável para criar e guardar em cada ambiente, e esquecer dela quebraria a tela. Pode substituir esta ADR se surgir um cofre de segredos.
- **Guardar em claro:** inaceitável, porque o link dá leitura da agenda pessoal.
- **Cifrar no navegador:** o servidor precisa do link em claro para buscar o `.ics`, então não resolve.

## Consequências
- Nenhuma configuração nova em homologação ou produção.
- **Trocar `BETTER_AUTH_SECRET` invalida todos os links salvos.** As pessoas precisam colá-los de novo, e a tela avisa com "Este link precisa ser colado de novo." Trocar esse segredo deve ser um evento raro e planejado.
- Quem tiver acesso ao banco e ao `BETTER_AUTH_SECRET` juntos consegue ler os links. O segredo nunca vai para o repositório.
