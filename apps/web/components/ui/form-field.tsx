import type { InputHTMLAttributes, ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-sm font-semibold text-slate-200"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs leading-5 text-slate-400">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs leading-5 text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="num min-h-11 w-full rounded-xl border border-white/12 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none transition-[border-color,box-shadow] duration-(--duration-micro) placeholder:text-slate-500 focus-visible:border-cyan-300/60 focus-visible:ring-2 focus-visible:ring-cyan-300/20 disabled:opacity-50 [color-scheme:dark]"
    />
  );
}
