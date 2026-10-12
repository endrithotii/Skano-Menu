import { redirect } from "next/navigation";

// The menu book now lives inside Menu Management (toggle at the top).
export default function UploadMenuPage() {
  redirect("/dashboard/menu?mode=book");
}
