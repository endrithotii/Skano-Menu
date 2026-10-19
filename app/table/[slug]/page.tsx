import type { Metadata } from "next";
import { RoomGuestPage } from "@/components/room-service/guest-page";

// Table ordering: the QR code for all tables. The guest writes their table number, or their name.
export const metadata: Metadata = { title: "Order at your table", robots: { index: false } };

export default async function TableOrderAll({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RoomGuestPage kind="table" slug={decodeURIComponent(slug)} roomId={null} />;
}
