import type { ReactNode } from "react";

import styles from "./field-error.module.css";

export function FieldError({
    children,
    id,
}: {
    children?: ReactNode;
    id: string;
}) {
    if (!children) return null;
    return (
        <small className={styles.error} id={id} role="alert">
            {children}
        </small>
    );
}

export function invalidFieldProps(id: string, error?: string) {
    return {
        "aria-describedby": error ? id : undefined,
        "aria-invalid": Boolean(error),
    } as const;
}
