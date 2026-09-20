"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PolicyPreview } from "@/components/organizer/policy-preview";
import { Button } from "@/components/ui/button";
import { FormField, TextInput } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { XlmFundingNotice } from "@/components/wallet/xlm-funding-notice";
import { createEvent, type CreateEventInput, type TxPhase } from "@/lib/contract";
import { toStroops } from "@/lib/domain";
import {
  EVENT_SCHEDULE_STEP_SECONDS,
  eveningStart,
  nextSaturdayEvening,
  scheduleAroundStart,
} from "@/lib/domain/event-schedule";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { getAccountAssets, type AccountAssets } from "@/lib/stellar";
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

export default function NewEventPage() {
  const router = useRouter();
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const accountState = useAsyncData<AccountAssets | null>(
    () => getAccountAssets(address!),
    [address],
    { enabled: Boolean(address) },
  );
  const accountAssets =
    accountState.status === "ready" ? accountState.data : null;
  const insufficientXlm =
    accountAssets !== null &&
    (!accountAssets.exists || accountAssets.spendableXlm === 0n);

  const communityShare = useMemo(() => {
    const share = Number(values.organizerShare);
    return Number.isFinite(share) ? Math.max(0, Math.min(100, 100 - share)) : 0;
  }, [values.organizerShare]);

  // The preview is fed from the same raw strings the form holds, parsed with
  // the same integer helper the submit path uses. A value the parser rejects
  // shows as "—" rather than as a guess.
  const previewBond = useMemo(() => {
    try {
      const parsed = toStroops(values.bond);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [values.bond]);

  const previewCapacity = useMemo(() => {
    const parsed = Number(values.capacity);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [values.capacity]);

  const previewShare = useMemo(() => {
    const parsed = Number(values.organizerShare);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100
      ? parsed
      : null;
  }, [values.organizerShare]);

  const set = (key: keyof FormValues) => (event: { target: { value: string } }) => {
    setValues((previous) => ({ ...previous, [key]: event.target.value }));
  };

  function applySchedule(startTime: string) {
    const schedule = scheduleAroundStart(startTime);
    if (!schedule) return;

    setValues((previous) => ({ ...previous, ...schedule }));
    setErrors((previous) => ({
      ...previous,
      startTime: undefined,
      checkinStart: undefined,
      checkinDeadline: undefined,
      cancellationDeadline: undefined,
    }));
  }

  function applyPreset(kind: "tomorrow" | "saturday") {
    const now = Date.now();
    const startTime =
      kind === "tomorrow"
        ? eveningStart(now, 1)
        : nextSaturdayEvening(now);
    applySchedule(startTime);
  }

  const busy = tx.kind === "running";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!address || insufficientXlm) return;

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
      setTx(
        txFailureState(
          error,
          "The event could not be created. Refresh and try again.",
        ),
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
      <Link
        className="text-sm font-semibold text-slate-400 transition hover:text-brand"
        href="/organizer"
      >
        ← Your events
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em]">
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
          <Button
            className="mt-4"
            disabled={status === "connecting"}
            onClick={() => void connect()}
            type="button"
          >
            {status === "connecting" ? "Connecting…" : "Connect wallet"}
          </Button>
        </div>
      ) : null}

      {canTransact && insufficientXlm && address ? (
        <div className="mt-8">
          <XlmFundingNotice
            address={address}
            title={
              accountAssets?.exists
                ? "Add spendable Testnet XLM"
                : "Fund this Testnet account"
            }
          >
            {accountAssets?.exists
              ? "This account has no XLM available above its current reserve and native liabilities, so it cannot pay for an event-creation transaction."
              : "This account does not exist on Testnet yet. Friendbot can create and fund it before you publish an event."}
          </XlmFundingNotice>
        </div>
      ) : null}

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.35fr_0.65fr]">
      <form className="flex flex-col gap-8" onSubmit={onSubmit}>
        <fieldset
          className="flex flex-col gap-6 disabled:opacity-50"
          disabled={!canTransact || busy || insufficientXlm}
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

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Schedule</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                  Times use your device&apos;s local timezone. Start with a preset
                  or choose the event start, then fill the policy around it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => applyPreset("tomorrow")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Tomorrow, 19:00
                </Button>
                <Button
                  onClick={() => applyPreset("saturday")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next Saturday, 19:00
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <FormField
                error={errors.startTime}
                hint="The advertised start time."
                htmlFor="startTime"
                label="Event starts"
              >
                <TextInput
                  id="startTime"
                  onChange={set("startTime")}
                  step={EVENT_SCHEDULE_STEP_SECONDS}
                  type="datetime-local"
                  value={values.startTime}
                />
              </FormField>

              <div className="flex items-end">
                <Button
                  className="w-full sm:w-auto"
                  disabled={!values.startTime}
                  onClick={() => applySchedule(values.startTime)}
                  type="button"
                  variant="secondary"
                >
                  Fill times around start
                </Button>
              </div>

              <FormField
                error={errors.checkinStart}
                hint="Suggested: 30 minutes before the event."
                htmlFor="checkinStart"
                label="Check-in opens"
              >
                <TextInput
                  id="checkinStart"
                  max={values.startTime || undefined}
                  onChange={set("checkinStart")}
                  step={EVENT_SCHEDULE_STEP_SECONDS}
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
                  min={values.startTime || values.checkinStart || undefined}
                  onChange={set("checkinDeadline")}
                  step={EVENT_SCHEDULE_STEP_SECONDS}
                  type="datetime-local"
                  value={values.checkinDeadline}
                />
              </FormField>
              <FormField
                error={errors.cancellationDeadline}
                hint="Until this moment a participant can cancel and get everything back."
                htmlFor="cancellationDeadline"
                label="Free cancellation until"
              >
                <TextInput
                  id="cancellationDeadline"
                  max={values.checkinStart || undefined}
                  onChange={set("cancellationDeadline")}
                  step={EVENT_SCHEDULE_STEP_SECONDS}
                  type="datetime-local"
                  value={values.cancellationDeadline}
                />
              </FormField>
            </div>
          </section>

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

        <SubmitButton
          className="self-start"
          disabled={!canTransact || insufficientXlm}
          pending={busy}
          pendingLabel="Creating…"
          size="lg"
          type="submit"
        >
          Create event
        </SubmitButton>
      </form>

        <PolicyPreview
          bondStroops={previewBond}
          capacity={previewCapacity}
          organizerShare={previewShare}
        />
      </div>
    </main>
  );
}
