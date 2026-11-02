import { redirect } from "next/navigation";

// O dashboard chega na entrega 4; até lá, o módulo abre no catálogo.
export default function PaginaComercial() {
  redirect("/comercial/produtos");
}
