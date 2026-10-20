"use client";

import { MyWorkPage } from "@/components/hr/my-work";

// Check in / out: the first page staff see after signing in. See components/hr/my-work.tsx.
export default function CheckInPage() {
  return <MyWorkPage view="check" />;
}
