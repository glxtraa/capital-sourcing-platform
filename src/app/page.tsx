import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const lastWorkspace = cookieStore.get("tr3_last_workspace")?.value;

  if (lastWorkspace === "trade") {
    redirect("/trade-deals");
  } else if (lastWorkspace === "startups") {
    redirect("/vc-deals");
  } else {
    // Default to invoice factoring deals or last selected
    redirect("/deals");
  }
}
