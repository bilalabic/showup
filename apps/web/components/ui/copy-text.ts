/**
 * Copy a string to the clipboard.
 *
 * Some embedded and in-app browsers expose `navigator.clipboard` but deny it at
 * runtime, so a rejected promise falls through to a user-initiated DOM copy
 * before the caller is told it failed.
 */
export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the DOM path below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("The browser rejected the copy request.");
    }
  } finally {
    textarea.remove();
  }
}
