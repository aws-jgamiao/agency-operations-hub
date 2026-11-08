"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { idle, type ActionState } from "@/lib/action-state";
import { Button } from "./button";

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(idle);

/**
 * Form bound to a Server Action through useActionState.
 * - Keeps the user's input when validation fails (React would otherwise reset
 *   an uncontrolled form after every action).
 * - Still works without JavaScript through the `action` attribute.
 * - Announces the result in a live region.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
  ...rest
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
} & Omit<ComponentProps<"form">, "action" | "onSubmit" | "children">) {
  const [state, formAction] = useActionState(action, idle);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormStateContext value={state}>
      <form
        ref={ref}
        action={formAction}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className={className}
        noValidate
        {...rest}
      >
        {children}
        <FormMessage showSuccess={showSuccess} />
      </form>
    </FormStateContext>
  );
}

export function useFormState() {
  return use(FormStateContext);
}

function FormMessage({ showSuccess }: { showSuccess: boolean }) {
  const state = useFormState();
  const visible = state.status === "error" || (state.status === "success" && showSuccess);
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={
        visible
          ? `mt-3 rounded-lg px-3 py-2 text-sm ${
              state.status === "error" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"
            }`
          : "sr-only"
      }
    >
      {visible ? state.message : ""}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingText = "Saving…",
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

function useFieldIds(name: string) {
  const id = useId();
  const state = useFormState();
  const errors = state.status === "error" ? state.fieldErrors?.[name] : undefined;
  return { inputId: `${id}-input`, hintId: `${id}-hint`, errorId: `${id}-error`, errors };
}

function FieldShell({
  label,
  hint,
  inputId,
  hintId,
  errorId,
  errors,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  inputId: string;
  hintId: string;
  errorId: string;
  errors?: string[];
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-subtle">(optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {errors?.length ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

type FieldProps = { name: string; label: string; hint?: string; optional?: boolean };

function describedBy(hint: string | undefined, hintId: string, errors: string[] | undefined, errorId: string) {
  return [hint ? hintId : null, errors?.length ? errorId : null].filter(Boolean).join(" ") || undefined;
}

export function TextField({ name, label, hint, optional, ...input }: FieldProps & ComponentProps<"input">) {
  const ids = useFieldIds(name);
  return (
    <FieldShell label={label} hint={hint} optional={optional} {...ids}>
      <input
        id={ids.inputId}
        name={name}
        className="input"
        aria-invalid={ids.errors?.length ? true : undefined}
        aria-describedby={describedBy(hint, ids.hintId, ids.errors, ids.errorId)}
        required={!optional}
        {...input}
      />
    </FieldShell>
  );
}

export function TextAreaField({ name, label, hint, optional, ...input }: FieldProps & ComponentProps<"textarea">) {
  const ids = useFieldIds(name);
  return (
    <FieldShell label={label} hint={hint} optional={optional} {...ids}>
      <textarea
        id={ids.inputId}
        name={name}
        className="input min-h-24"
        aria-invalid={ids.errors?.length ? true : undefined}
        aria-describedby={describedBy(hint, ids.hintId, ids.errors, ids.errorId)}
        required={!optional}
        {...input}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  optional,
  options,
  ...select
}: FieldProps & ComponentProps<"select"> & { options: { value: string; label: string }[] }) {
  const ids = useFieldIds(name);
  return (
    <FieldShell label={label} hint={hint} optional={optional} {...ids}>
      <select
        id={ids.inputId}
        name={name}
        className="input"
        aria-invalid={ids.errors?.length ? true : undefined}
        aria-describedby={describedBy(hint, ids.hintId, ids.errors, ids.errorId)}
        {...select}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ name, label, hint, ...input }: FieldProps & ComponentProps<"input">) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        className="mt-1 size-4 accent-brand"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
