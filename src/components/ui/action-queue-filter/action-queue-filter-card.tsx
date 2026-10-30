'use client';

import type { ReactNode } from 'react';

import type { QueueSort } from './use-action-queue-filter';
import styles from './action-queue-filter-card.module.css';

type StatusOption<S extends string> = {
    value: S;
    label: string;
};

type Props<S extends string> = {
    title: string;
    description: string;
    placeholder: string;

    search: string;
    onSearchChange: (value: string) => void;

    status: S;
    onStatusChange: (value: S) => void;
    statusOptions: Array<StatusOption<S>>;

    /**
     * Optional extra filter used by Claims for Claim Type.
     * Other payment types can omit this property.
     */
    additionalField?: ReactNode;

    month: string;
    onMonthChange: (value: string) => void;

    exactDate: string;
    onExactDateChange: (value: string) => void;

    sort: QueueSort;
    onSortChange: (value: QueueSort) => void;

    onClear: () => void;
};

export function ActionQueueFilterCard<S extends string>(
    props: Props<S>,
) {
    return (
        <section className={styles.card}>
            <header>
                <div>
                    <h2>{props.title}</h2>
                    <p>{props.description}</p>
                </div>

                <button onClick={props.onClear} type="button">
                    Clear filters
                </button>
            </header>

            <div
                className={styles.fields}
                data-has-additional={Boolean(props.additionalField)}
            >
                <label>
                    <span>Search</span>
                    <input
                        onChange={(event) =>
                            props.onSearchChange(event.target.value)
                        }
                        placeholder={props.placeholder}
                        type="search"
                        value={props.search}
                    />
                </label>

                <label>
                    <span>Status</span>
                    <select
                        onChange={(event) =>
                            props.onStatusChange(event.target.value as S)
                        }
                        value={props.status}
                    >
                        {props.statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                {props.additionalField}

                <label>
                    <span>Month</span>
                    <input
                        onChange={(event) =>
                            props.onMonthChange(event.target.value)
                        }
                        type="month"
                        value={props.month}
                    />
                </label>

                <label>
                    <span>Exact date</span>
                    <input
                        max={props.month ? `${props.month}-31` : undefined}
                        min={props.month ? `${props.month}-01` : undefined}
                        onChange={(event) =>
                            props.onExactDateChange(event.target.value)
                        }
                        type="date"
                        value={props.exactDate}
                    />
                </label>

                <label>
                    <span>Sort by</span>
                    <select
                        onChange={(event) =>
                            props.onSortChange(event.target.value as QueueSort)
                        }
                        value={props.sort}
                    >
                        <option value="UPDATED_DESC">Newest updated</option>
                        <option value="UPDATED_ASC">Oldest waiting</option>
                        <option value="AMOUNT_DESC">Highest amount</option>
                        <option value="AMOUNT_ASC">Lowest amount</option>
                    </select>
                </label>
            </div>
        </section>
    );
}