import { redirect } from "next/navigation";

// O dashboard chega na entrega 4; até lá, o módulo abre nas vendas.
export default function PaginaComercial() {
  redirect("/comercial/vendas");
}
