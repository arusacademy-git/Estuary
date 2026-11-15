"use client";

import { useSearchParams } from "next/navigation";

import { MyRequests } from "./my-requests";
import { PaymentRecords } from "./payment-records";

export default function PaymentRecordsPage() {
  const searchParameters = useSearchParams();
  return searchParameters.get("scope") === "mine" ? (
    <MyRequests />
  ) : (
    <PaymentRecords />
  );
}
