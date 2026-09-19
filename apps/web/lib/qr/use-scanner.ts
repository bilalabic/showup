"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { IScannerControls } from "@zxing/browser";

export type ScannerState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "scanning" }
  | { status: "error"; message: string };

function cameraErrorMessage(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  switch (name) {
    case "NotAllowedError":
      return "Camera permission was denied or blocked by browser policy.";
    case "NotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is busy or could not be started.";
    case "OverconstrainedError":
      return "No camera matches the requested settings.";
    case "SecurityError":
      return "Camera access is disabled. Use HTTPS or localhost and check browser settings.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "The camera could not be started.";
  }
}

function isExpectedFrameMiss(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return (
    name === "NotFoundException" ||
    name === "ChecksumException" ||
    name === "FormatException"
  );
}

export function useScanner(onResult: (raw: string) => void) {
  const [state, setState] = useState<ScannerState>({ status: "idle" });
  const controlsRef = useRef<IScannerControls | null>(null);
  const generationRef = useRef(0);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setState({ status: "idle" });
  }, []);

  const start = useCallback(async (video: HTMLVideoElement) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    controlsRef.current?.stop();
    controlsRef.current = null;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({
        status: "error",
        message:
          "Camera scanning requires HTTPS or localhost and a supported browser.",
      });
      return;
    }

    setState({ status: "requesting" });
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (generationRef.current !== generation) return;

      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 100,
        delayBetweenScanSuccess: 500,
      });
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result, error, activeControls) => {
          if (generationRef.current !== generation) {
            activeControls.stop();
            return;
          }

          if (result) {
            generationRef.current += 1;
            activeControls.stop();
            controlsRef.current = null;
            setState({ status: "idle" });
            onResultRef.current(result.getText());
            return;
          }

          if (error && !isExpectedFrameMiss(error)) {
            generationRef.current += 1;
            activeControls.stop();
            controlsRef.current = null;
            setState({ status: "error", message: cameraErrorMessage(error) });
          }
        },
      );

      if (generationRef.current !== generation) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setState({ status: "scanning" });
    } catch (error) {
      if (generationRef.current === generation) {
        controlsRef.current?.stop();
        controlsRef.current = null;
        setState({ status: "error", message: cameraErrorMessage(error) });
      }
    }
  }, []);

  useEffect(
    () => () => {
      generationRef.current += 1;
      controlsRef.current?.stop();
      controlsRef.current = null;
    },
    [],
  );

  return { state, start, stop };
}
