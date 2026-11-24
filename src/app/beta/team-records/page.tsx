"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchTeamRecords,
  type TeamRecord,
} from "@/data/team-records/team-records-api";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import { TeamRecordsWorkspace } from "./team-records-workspace";

export default function TeamRecordsPage() {
  const searchParameters = useSearchParams();
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [error, setError] = useState(() =>
    account ? "" : "Sign in to view Team Records.",
  );
  const [loading, setLoading] = useState(Boolean(account));

  useEffect(() => {
    if (!account) return;
    let active = true;
    fetchTeamRecords(account)
      .then((nextRecords) => {
        if (active) setRecords(nextRecords);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Team Records could not load.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account]);

  if (error) return <TeamRecordsWorkspace error={error} records={[]} />;
  if (loading || !account) return <TeamRecordsWorkspace loading records={[]} />;
  const requestedGroup = searchParameters.get("group");
  const initialView =
    searchParameters.get("view") === "analysis" ? "ANALYSIS" : "RECORDS";
  const initialGroup = [
    "APPROVAL",
    "PAYMENT",
    "COMPLETED",
    "RECONCILED",
    "INACTIVE",
  ].includes(requestedGroup ?? "")
    ? (requestedGroup as
      | "APPROVAL"
      | "PAYMENT"
      | "COMPLETED"
      | "RECONCILED"
      | "INACTIVE")
    : "APPROVAL";
  return (
    <TeamRecordsWorkspace
      account={account}
      initialGroup={initialGroup}
      initialView={initialView}
      records={records}
    />
  );
}
