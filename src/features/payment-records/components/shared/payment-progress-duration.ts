import type { BusinessCalendar } from "./payment-progress-types";

const defaultCalendar: Required<BusinessCalendar> = {
    holidays: [],
    workingWeekdays: [1, 2, 3, 4, 5],
    workdayStartHour: 9,
    workdayEndHour: 17,
};

function validDate(value: string | Date | null | undefined) {
    if (!value) return null;
    const parsed = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateKey(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function businessMinutesBetween(
    startValue: string | Date | null | undefined,
    endValue: string | Date | null | undefined,
    calendar: BusinessCalendar = {},
) {
    const start = validDate(startValue);
    const end = validDate(endValue);
    if (!start || !end || end <= start) return 0;

    const settings = { ...defaultCalendar, ...calendar };
    const holidays = new Set(settings.holidays);
    const workingWeekdays = new Set(settings.workingWeekdays);
    let totalMilliseconds = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(end);
    lastDay.setHours(0, 0, 0, 0);

    while (cursor <= lastDay) {
        if (
            workingWeekdays.has(cursor.getDay()) &&
            !holidays.has(localDateKey(cursor))
        ) {
            const workdayStart = new Date(cursor);
            workdayStart.setHours(settings.workdayStartHour, 0, 0, 0);
            const workdayEnd = new Date(cursor);
            workdayEnd.setHours(settings.workdayEndHour, 0, 0, 0);
            const intervalStart = new Date(
                Math.max(start.getTime(), workdayStart.getTime()),
            );
            const intervalEnd = new Date(
                Math.min(end.getTime(), workdayEnd.getTime()),
            );
            if (intervalEnd > intervalStart)
                totalMilliseconds += intervalEnd.getTime() - intervalStart.getTime();
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return Math.round(totalMilliseconds / 60_000);
}

export function formatBusinessDuration(
    minutes: number,
    calendar: BusinessCalendar = {},
) {
    const settings = { ...defaultCalendar, ...calendar };
    const minutesPerDay =
        (settings.workdayEndHour - settings.workdayStartHour) * 60;
    if (minutes <= 0) return "Less than 1 working hour";
    if (minutes < 60) return `${minutes} min`;
    if (minutes < minutesPerDay) {
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
    }
    const days = Math.floor(minutes / minutesPerDay);
    const remainder = minutes % minutesPerDay;
    const dayLabel = `${days} working day${days === 1 ? "" : "s"}`;
    if (remainder === 0) return dayLabel;
    const hours = Math.round((remainder / 60) * 10) / 10;
    return `${dayLabel} ${hours}h`;
}

export function formatTimelineTimestamp(
    value: string | Date | null | undefined,
) {
    const date = validDate(value);
    if (!date) return null;
    return new Intl.DateTimeFormat("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}
