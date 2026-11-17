import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/sessao";
import { abasDoPapel } from "@/modulos/whatsapp/componentes/abas-whatsapp";

export default async function PaginaWhatsapp() {
  const usuario = await exigirUsuario();
  const primeira = abasDoPapel(usuario.papel)[0];
  redirect(primeira ? primeira.href : "/inicio?erro=sem-permissao");
}
