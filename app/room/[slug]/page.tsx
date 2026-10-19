import type { Metadata } from "next";
import { RoomGuestPage } from "@/components/room-service/guest-page";

// Room service: the QR code for all rooms. The guest writes their room, or their name and surname.
export const metadata: Metadata = { title: "Room service", robots: { index: false } };

export default async function RoomServiceAll({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RoomGuestPage slug={decodeURIComponent(slug)} roomId={null} />;
}
