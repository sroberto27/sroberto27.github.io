/** Supplied media only; object URLs exist only while the viewer is open. */
export async function openMedia(media, doc = document, isActive = () => true) {
 if (media.missing || !media.data) return;
 const bytes = Uint8Array.from(atob(media.data), c => c.charCodeAt(0));
 const url = URL.createObjectURL(media.blob ?? new Blob([bytes], { type: media.mime }));
 const previous = doc.activeElement;
 if (media.kind === "panorama") {
  try { const { openPanorama } = await import("./panorama-viewer.js"); if (!isActive()) { URL.revokeObjectURL(url); return; } return openPanorama(url, { title: media.filename, onClose: () => { URL.revokeObjectURL(url); previous?.focus(); } }); }
  catch { URL.revokeObjectURL(url); throw new Error("Panorama viewer could not load."); }
 }
 const dialog = doc.createElement("dialog"), close = doc.createElement("button"), content = doc.createElement(media.kind === "video" ? "video" : "img");
 close.textContent = "Close media"; content.src = url; content.alt = media.filename; content.controls = true; content.style.maxWidth = "100%";
 const cleanup = () => { content.pause?.(); content.removeAttribute("src"); URL.revokeObjectURL(url); dialog.remove(); previous?.focus(); };
 close.addEventListener("click", () => dialog.close()); dialog.addEventListener("close", cleanup); dialog.append(close, content); doc.body.append(dialog); dialog.showModal(); close.focus();
 return { close: () => dialog.close() };
}
