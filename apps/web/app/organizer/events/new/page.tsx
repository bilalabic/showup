"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FormField, TextInput } from "@/components/ui/form-field";
import { TxStatus, type TxState } from "@/components/tx/tx-status";
import { createEvent, type CreateEventInput, type TxPhase } from "@/lib/contract";
import { toStroops } from "@/lib/domain";
import { isWalletError } from "@/lib/wallet/port";
import { useWallet } from "@/lib/wallet/provider";

// Mirrors the contract's own bounds in contracts/showup-bond/src/types.rs. The
// input caps are a courtesy; `create_event` rejects anything longer regardless.
const MAX_TITLE_LENGTH = 96;
const MAX_VENUE_LENGTH = 160;

type FormValues = {
  title: string;
  venue: string;
  bond: string;
  capacity: string;
  organizerShare: string;
  startTime: string;
  checkinStart: string;
  checkinDeadline: string;
  cancellationDeadline: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY: FormValues = {
  title: "",
  venue: "",
  bond: "5.00",
  capacity: "20",
  organizerShare: "80",
  startTime: "",
  checkinStart: "",
  checkinDeadline: "",
  cancellationDeadline: "",
};

/** `datetime-local` yields wall-clock text; the contract wants unix seconds. */
function toUnixSeconds(local: string): number | null {
  if (!local) return null;
  const parsed = Date.parse(local);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

// Client-side validation exists to give fast, field-level feedback. It is never
// the authority: the contract re-checks every one of these rules, and a form
// that somehow passed here would still be rejected on chain.
function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.title.trim()) errors.title = "Give the event a name.";
  if (!values.venue.trim()) errors.venue = "Where is it happening?";

  let bond: bigint | null = null;
  try {
    bond = toStroops(values.bond);
  } catch {
    bond = null;
  }
  if (bond === null || bond <= 0n) {
    errors.bond = "Enter a bond above zero, for example 5.00.";
  }

  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.capacity = "Capacity must be a whole number above zero.";
  }

  const share = Number(values.organizerShare);
  if (!Number.isInteger(share) || share < 0 || share > 100) {
    errors.organizerShare = "Enter a whole percentage between 0 and 100.";
  }

  const start = toUnixSeconds(values.startTime);
  const checkinStart = toUnixSeconds(values.checkinStart);
  const checkinDeadline = toUnixSeconds(values.checkinDeadline);
  const cancellationDeadline = toUnixSeconds(values.cancellationDeadline);

  if (start === null) errors.startTime = "Pick a start time.";
  if (checkinStart === null) errors.checkinStart = "Pick a check-in opening time.";
  if (checkinDeadline === null) errors.checkinDeadline = "Pick a check-in closing time.";
  if (cancellationDeadline === null) {
    errors.cancellationDeadline = "Pick a free-cancellation deadline.";
  }

  if (cancellationDeadline !== null && checkinStart !== null && cancellationDeadline > checkinStart) {
    errors.cancellationDeadline = "Free cancellation must close before check-in opens.";
  }
  if (checkinStart !== null && checkinDeadline !== null && checkinStart > checkinDeadline) {
    errors.checkinDeadline = "Check-in must close after it opens.";
  }
  if (start !== null && checkinStart !== null && checkinDeadline !== null) {
    if (start < checkinStart || start > checkinDeadline) {
      errors.startTime = "The start time must fall inside the check-in window.";
    }
  }

  return errors;
}

// Wallet failures arrive as a typed union rather than an Error, so they need
// their own copy — a rejected signature is not a fault the user should see as
// "something went wrong".
function failureMessage(error: unknown): string {
  if (isWalletError(error)) {
    switch (error.kind) {
      case "rejected":
        return "You declined the signature. Nothing was created and nothing was spent.";
      case "wrong_network":
        return "Freighter is not on Stellar Testnet. Switch networks and try again.";
      case "no_wallet":
        return "Freighter is not available. Install or unlock it, then try again.";
      case "not_connected":
        return "Your wallet disconnected. Reconnect and try again.";
      default:
        return "The wallet could not complete the signature. Please try again.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The event could not be created. Please try again.";
}

export default function NewEventPage() {
  const router = useRouter();
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const communityShare = useMemo(() => {
    const share = Number(values.organizerShare);
    return Number.isFinite(share) ? Math.max(0, Math.min(100, 100 - share)) : 0;
  }, [values.organizerShare]);

  const set = (key: keyof FormValues) => (event: { target: { value: string } }) => {
    setValues((previous) => ({ ...previous, [key]: event.target.value }));
  };

  const busy = tx.kind === "running";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!address) return;

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTx({ kind: "idle" });
      return;
    }

    const organizerBps = Number(values.organizerShare) * 100;
    const input: CreateEventInput = {
      organizer: address,
      title: values.title.trim(),
      venue: values.venue.trim(),
      bondAmount: toStroops(values.bond),
      capacity: Number(values.capacity),
      startTime: toUnixSeconds(values.startTime)!,
      checkinStart: toUnixSeconds(values.checkinStart)!,
      checkinDeadline: toUnixSeconds(values.checkinDeadline)!,
      cancellationDeadline: toUnixSeconds(values.cancellationDeadline)!,
      organizerBps,
      communityBps: 10_000 - organizerBps,
    };

    setTx({ kind: "running", phase: "simulating" });

    try {
      const { eventId, hash } = await createEvent(
        input,
        { address, signTransaction },
        (phase: TxPhase) => setTx({ kind: "running", phase }),
      );

      setTx({
        kind: "success",
        hash,
        message: `Event #${eventId} is live on Testnet.`,
      });
      router.push(`/events/${eventId}`);
    } catch (error) {
      setTx({ kind: "failed", message: failureMessage(error) });
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <Link
        className="text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        href="/organizer"
      >
        ← Your events
      </Link>

      <h1 className="mt-6 text-4xl font-black tracking-[-0.04em]">
        Create an event
      </h1>
      <p className="mt-3 max-w-xl leading-7 text-slate-400">
        Everything below becomes the published policy. Once the first bond is
        locked it cannot be changed, so participants always see the rules they
        agreed to.
      </p>

      {!canTransact ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 px-5 py-6">
          <p className="text-sm leading-6 text-slate-300">
            Connect your Testnet wallet to create an event. You will sign one
            transaction; no funds leave your account.
          </p>
          <button
            className="mt-4 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            disabled={status === "connecting"}
            onClick={() => void connect()}
            type="button"
          >
            {status === "connecting" ? "Connecting…" : "Connect Freighter"}
          </button>
        </div>
      ) : null}

      <form className="mt-10 flex flex-col gap-8" onSubmit={onSubmit}>
        <fieldset
          className="flex flex-col gap-6 disabled:opacity-50"
          disabled={!canTransact || busy}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField error={errors.title} htmlFor="title" label="Event name">
              <TextInput
                id="title"
                maxLength={MAX_TITLE_LENGTH}
                onChange={set("title")}
                placeholder="AI Builders Meetup Istanbul"
                value={values.title}
              />
            </FormField>
            <FormField error={errors.venue} htmlFor="venue" label="Venue">
              <TextInput
                id="venue"
                maxLength={MAX_VENUE_LENGTH}
                onChange={set("venue")}
                placeholder="Grand Pera, Beyoglu"
                value={values.venue}
              />
            </FormField>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              error={errors.bond}
              hint="Refunded in full when the participant checks in."
              htmlFor="bond"
              label="Attendance bond (USDC)"
            >
              <TextInput
                id="bond"
                inputMode="decimal"
                onChange={set("bond")}
                value={values.bond}
              />
            </FormField>
            <FormField
              error={errors.capacity}
              hint="Enforced on chain — reservations stop at this number."
              htmlFor="capacity"
              label="Capacity"
            >
              <TextInput
                id="capacity"
                inputMode="numeric"
                onChange={set("capacity")}
                value={values.capacity}
              />
            </FormField>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              error={errors.cancellationDeadline}
              hint="Until this moment a participant can cancel and get everything back."
              htmlFor="cancellationDeadline"
              label="Free cancellation until"
            >
              <TextInput
                id="cancellationDeadline"
                onChange={set("cancellationDeadline")}
                type="datetime-local"
                value={values.cancellationDeadline}
              />
            </FormField>
            <FormField
              error={errors.startTime}
              htmlFor="startTime"
              label="Event starts"
            >
              <TextInput
                id="startTime"
                onChange={set("startTime")}
                type="datetime-local"
                value={values.startTime}
              />
            </FormField>
            <FormField
              error={errors.checkinStart}
              htmlFor="checkinStart"
              label="Check-in opens"
            >
              <TextInput
                id="checkinStart"
                onChange={set("checkinStart")}
                type="datetime-local"
                value={values.checkinStart}
              />
            </FormField>
            <FormField
              error={errors.checkinDeadline}
              hint="After this, unclaimed bonds can be settled as no-shows."
              htmlFor="checkinDeadline"
              label="Check-in closes"
            >
              <TextInput
                id="checkinDeadline"
                onChange={set("checkinDeadline")}
                type="datetime-local"
                value={values.checkinDeadline}
              />
            </FormField>
          </div>

          <FormField
            error={errors.organizerShare}
            hint={`If someone does not show up: ${values.organizerShare || 0}% to you, ${communityShare}% to the community pool.`}
            htmlFor="organizerShare"
            label="No-show settlement — your share (%)"
          >
            <TextInput
              id="organizerShare"
              inputMode="numeric"
              onChange={set("organizerShare")}
              value={values.organizerShare}
            />
          </FormField>
        </fieldset>

        <TxStatus state={tx} />

        <button
          className="self-start rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canTransact || busy}
          type="submit"
        >
          {busy ? "Creating…" : "Create event"}
        </button>
      </form>
    </main>
  );
}
