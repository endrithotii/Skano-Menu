import type { Metadata } from "next";
import { RoomGuestPage } from "@/components/room-service/guest-page";

// Table ordering: the QR code of one table. The table is already known.
export const metadata: Metadata = { title: "Order at your table", robots: { index: false } };

export default async function TableOrder({ params }: { params: Promise<{ slug: string; tableId: string }> }) {
  const { slug, tableId } = await params;
  return <RoomGuestPage kind="table" slug={decodeURIComponent(slug)} roomId={tableId} />;
}
