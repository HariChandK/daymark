import { redirect } from "next/navigation";
import { getChatGPTUser } from "./chatgpt-auth";
import DaymarkClient from "./daymark-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const signedInUser = await getChatGPTUser();
  if (!signedInUser && process.env.NODE_ENV === "production") {
    redirect("/signin-with-chatgpt?return_to=%2F");
  }

  const user = signedInUser ?? {
    displayName: "Hari",
    email: "local@daymark.app",
    fullName: "Hari",
  };

  return <DaymarkClient user={user} />;
}
