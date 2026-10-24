import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function Home() {
  // Mark dynamic so Cache Components / instant validation tolerates NEXT_REDIRECT.
  await connection();
  redirect("/dashboard");
}
