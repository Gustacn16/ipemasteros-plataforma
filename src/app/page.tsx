import { redirect } from "next/navigation";

// A área logada valida a sessão e manda para o login quando preciso.
export default function Raiz() {
  redirect("/inicio");
}
