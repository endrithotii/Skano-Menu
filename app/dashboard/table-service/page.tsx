"use client";

import { ServicePage } from "@/components/room-service/service-page";

// Table ordering: guests order from their table with a QR code. See components/room-service/service-page.tsx.
export default function TableServicePage() {
  return <ServicePage kind="table" />;
}
