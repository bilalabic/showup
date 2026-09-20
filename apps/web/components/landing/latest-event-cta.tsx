"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listEvents } from "@/lib/contract";
import { useAsyncData } from "@/lib/hooks/use-async-data";

export function LatestEventCta() {
  const state = useAsyncData(async () => listEvents({ limit: 1 }), []);

  if (state.status === "loading") {
    return <Skeleton className="h-[3.25rem] w-40 rounded-full bg-white/8" />;
  }

  if (state.status === "error") {
    return (
      <Button onClick={state.reload} size="lg" type="button" variant="outline">
        Retry events
      </Button>
    );
  }

  const event = state.data[0];
  if (!event) return null;

  return (
    <Button asChild size="lg" variant="outline">
      <Link href={`/events/${event.id.toString()}`}>View latest event</Link>
    </Button>
  );
}
