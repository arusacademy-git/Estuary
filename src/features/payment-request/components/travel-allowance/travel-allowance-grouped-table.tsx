import type { ReactNode } from "react";

import type { TravelAllowanceLine } from "@/domain/payment-requests/travel-allowance/types";
import { travelLineTotal } from "@/domain/payment-requests/travel-allowance/types";

import styles from "./travel-allowance-grouped-table.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);

function displayDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function TravelAllowanceGroupedTable({
  lines,
}: {
  lines: TravelAllowanceLine[];
}) {
  const groups = lines.reduce<
    Array<{
      key: string;
      date: string;
      project: string;
      lines: TravelAllowanceLine[];
    }>
  >((current, line) => {
    const key = `${line.travelDate}:${line.projectName}`;
    const existing = current.find((group) => group.key === key);
    if (existing) existing.lines.push(line);
    else
      current.push({
        key,
        date: line.travelDate,
        project: line.projectName,
        lines: [line],
      });
    return current;
  }, []);

  return (
    <div className={styles.wrapper}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Employee</th>
            <th>Reason</th>
            <th>Meals</th>
            <th>Special</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) => {
            const subtotal = group.lines.reduce(
              (sum, line) => sum + travelLineTotal(line),
              0,
            );
            const firstRowNumber =
              groups
                .slice(0, groupIndex)
                .reduce((count, previous) => count + previous.lines.length, 0) +
              1;
            return (
              <FragmentGroup key={group.key}>
                <tr className={styles.groupRow}>
                  <td colSpan={4}>
                    <strong>{displayDate(group.date)}</strong>
                    <span>{group.project}</span>
                  </td>
                  <td colSpan={2}>
                    {group.lines.length} {group.lines.length === 1 ? "employee" : "employees"}
                    <strong>{money(subtotal)}</strong>
                  </td>
                </tr>
                {group.lines.map((line, lineIndex) => {
                  const rowNumber = firstRowNumber + lineIndex;
                  return (
                    <tr key={line.id}>
                      <td>{rowNumber}</td>
                      <td>{line.employeeName}</td>
                      <td>{line.reason}</td>
                      <td>
                        {line.meals
                          .map(
                            (meal) =>
                              meal[0] + meal.slice(1).toLowerCase(),
                          )
                          .join(", ") || "—"}
                      </td>
                      <td>{money(line.specialAllowance)}</td>
                      <td>
                        <strong>{money(travelLineTotal(line))}</strong>
                      </td>
                    </tr>
                  );
                })}
              </FragmentGroup>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>Overall total</td>
            <td>
              <strong>
                {money(
                  lines.reduce(
                    (sum, line) => sum + travelLineTotal(line),
                    0,
                  ),
                )}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FragmentGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

