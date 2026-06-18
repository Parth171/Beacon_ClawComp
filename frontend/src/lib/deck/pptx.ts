// Client-side PPTX export. Each deck slide is rendered to a high-resolution PNG
// (so Recharts SVG, KaTeX equations, and inline illustrations all survive), laid
// into a 16:9 PptxGenJS deck, then a Fade slide transition is injected into every
// slide's OOXML — PptxGenJS has no animation API, so we post-process the zip.
//
// All three heavy libs are dynamically imported so they never touch the main
// bundle; they load only when the user actually clicks Export → PPTX.

// 16:9 capture size (px) and the matching PowerPoint page (inches).
const CAPTURE_W = 1280;
const CAPTURE_H = 720;
const PAGE_W_IN = 13.333;
const PAGE_H_IN = 7.5;

const FADE_TRANSITION = '<p:transition spd="med"><p:fade/></p:transition>';

export async function exportDeckToPptx(
  nodes: HTMLElement[],
  fileName = "beacon-deck.pptx",
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const [{ toPng }, pptxMod, jszipMod] = await Promise.all([
    import("html-to-image"),
    import("pptxgenjs"),
    import("jszip"),
  ]);
  const PptxGenJS = pptxMod.default;
  const JSZip = jszipMod.default;

  // 1 · Capture each slide node to a PNG data URL.
  const images: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const dataUrl = await toPng(nodes[i], {
      width: CAPTURE_W,
      height: CAPTURE_H,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
    images.push(dataUrl);
    onProgress?.(i + 1, nodes.length);
  }

  // 2 · Build the 16:9 deck, one full-bleed image per slide.
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "BEACON_16x9", width: PAGE_W_IN, height: PAGE_H_IN });
  pptx.layout = "BEACON_16x9";
  for (const img of images) {
    const slide = pptx.addSlide();
    slide.addImage({ data: img, x: 0, y: 0, w: PAGE_W_IN, h: PAGE_H_IN });
  }

  // 3 · Inject a Fade transition into every slide's XML, then re-zip.
  const buf = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  const zip = await JSZip.loadAsync(buf);
  const slidePaths = Object.keys(zip.files).filter((p) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(p),
  );
  for (const path of slidePaths) {
    const xml = await zip.file(path)!.async("string");
    if (!xml.includes("<p:transition")) {
      // <p:transition> must sit after <p:clrMapOvr> and before any <p:timing>;
      // image slides have no timing, so just before </p:sld> is schema-valid.
      zip.file(path, xml.replace("</p:sld>", `${FADE_TRANSITION}</p:sld>`));
    }
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
