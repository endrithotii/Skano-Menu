import type { Metadata } from "next";
import { RoomGuestPage } from "@/components/room-service/guest-page";

// Room service: the QR code of one room. The room is already known.
export const metadata: Metadata = { title: "Room service", robots: { index: false } };

export default async function RoomServiceRoom({ params }: { params: Promise<{ slug: string; roomId: string }> }) {
  const { slug, roomId } = await params;
  return <RoomGuestPage slug={decodeURIComponent(slug)} roomId={roomId} />;
}
