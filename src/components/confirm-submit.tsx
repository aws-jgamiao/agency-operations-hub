"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Submit button that asks for confirmation before destructive actions. */
export function ConfirmSubmit({ message, children, ...props }: ComponentProps<typeof Button> & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
