"use client";

import { useState, type CSSProperties, type ChangeEvent } from "react";

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

const fmt = (x: number) => "$" + Math.round(x).toLocaleString("en-US");

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  const expanded = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const parsed = parseInt(expanded, 16);
  if (expanded.length !== 6 || Number.isNaN(parsed)) return [0, 230, 118];
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

// Rasterizes the uploaded SVG/PNG into a PNG data URL so jsPDF can embed it reliably.
function rasterizeLogo(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const maxWidth = 320;
      const scale = Math.min(1, maxWidth / (image.naturalWidth || maxWidth));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((image.naturalWidth || maxWidth) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || maxWidth) * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not load the uploaded logo"));
    image.src = dataUrl;
  });
}

export default function Home() {
  const [isScanning, setIsScanning] = useState(true);
  const [agencyName, setAgencyName] = useState("Northstar Digital");
  const [audits, setAudits] = useState(20);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00e676");
  const [secondaryColor, setSecondaryColor] = useState("#067a3e");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const replayScan = () => {
    setIsScanning(false);
    setTimeout(() => setIsScanning(true), 50);
  };

  const displayName = agencyName.trim() || "Your Agency";
  const initial = displayName.charAt(0).toUpperCase();

  const hours = audits * 1.5;
  const value = hours * 50;
  const net = value - 39;
  const percent = ((audits - 5) / 45) * 100;

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(svg\+xml|png)$/.test(file.type)) {
      setLogoError("Please upload an SVG or PNG file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be smaller than 2MB.");
      return;
    }
    setLogoError("");
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.onerror = () => setLogoError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const generateReportPdf = async () => {
    setIsGeneratingPdf(true);
    setLogoError("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 44;
      const primary = hexToRgb(primaryColor);
      const secondary = hexToRgb(secondaryColor);
      const ink: [number, number, number] = [11, 26, 18];
      const muted: [number, number, number] = [85, 102, 92];
      const fail: [number, number, number] = [180, 32, 42];

      let logoPng: string | null = null;
      if (logoDataUrl) {
        try {
          logoPng = await rasterizeLogo(logoDataUrl);
        } catch {
          logoPng = null;
        }
      }

      const drawHeader = (label: string) => {
        pdf.setFillColor(11, 26, 18);
        pdf.rect(0, 0, pageWidth, 90, "F");
        if (logoPng) {
          pdf.addImage(logoPng, "PNG", margin, 18, 120, 36, undefined, "FAST");
        } else {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(16);
          pdf.setTextColor(primary[0], primary[1], primary[2]);
          pdf.text(displayName.toUpperCase(), margin, 42);
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(220, 230, 224);
        pdf.text(label, pageWidth - margin, 42, { align: "right" });
        pdf.setDrawColor(primary[0], primary[1], primary[2]);
        pdf.setLineWidth(2);
        pdf.line(0, 90, pageWidth, 90);
      };

      const drawFooter = (pageNum: number, pageCount: number) => {
        const y = pageHeight - 34;
        pdf.setDrawColor(secondary[0], secondary[1], secondary[2]);
        pdf.setLineWidth(1);
        pdf.line(margin, y, pageWidth - margin, y);
        const textX = logoPng ? margin + 58 : margin;
        if (logoPng) pdf.addImage(logoPng, "PNG", margin, y + 8, 50, 15, undefined, "FAST");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(muted[0], muted[1], muted[2]);
        pdf.text(displayName, textX, y + 19);
        pdf.text(`${pageNum} / ${pageCount}`, pageWidth - margin, y + 19, { align: "right" });
      };

      drawHeader("WEBSITE AUDIT REPORT");
      let y = 130;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text("Executive website audit", margin, y);
      y += 22;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(muted[0], muted[1], muted[2]);
      pdf.text("brightside-dental.com", margin, y);
      y += 26;

      pdf.setFillColor(241, 244, 236);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, 70, 6, 6, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(32);
      pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
      pdf.text("62", margin + 20, y + 46);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text("Health score for brightside-dental.com", margin + 90, y + 28);
      pdf.setTextColor(muted[0], muted[1], muted[2]);
      pdf.text("12 issues - about 23 missed leads a month", margin + 90, y + 44);
      y += 70 + 24;

      const rows: Array<[string, boolean]> = [
        ["Analytics pixel", false],
        ["Call to action", false],
        ["Meta description", false],
        ["Page structure", true],
      ];
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text("FINDINGS", margin, y);
      y += 14;
      for (const [label, pass] of rows) {
        pdf.setDrawColor(225, 232, 225);
        pdf.line(margin, y, pageWidth - margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(ink[0], ink[1], ink[2]);
        pdf.text(label, margin, y + 16);
        const tagColor = pass ? secondary : fail;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(tagColor[0], tagColor[1], tagColor[2]);
        pdf.text(pass ? "PASS" : "FAIL", pageWidth - margin, y + 16, { align: "right" });
        y += 24;
      }

      y += 10;
      const pitch = `Hi John, I'm from ${displayName}. I audited your website and found several things that are likely costing you customers...`;
      const pitchLines = pdf.splitTextToSize(pitch, pageWidth - margin * 2 - 28) as string[];
      const pitchHeight = pitchLines.length * 14 + 24;
      pdf.setFillColor(236, 247, 240);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, pitchHeight, 6, 6, "F");
      pdf.setFillColor(primary[0], primary[1], primary[2]);
      pdf.rect(margin, y, 4, pitchHeight, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text("Pitch script", margin + 16, y + 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(muted[0], muted[1], muted[2]);
      pdf.text(pitchLines, margin + 16, y + 30);

      pdf.addPage();
      drawHeader("NEXT STEPS");
      y = 130;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(ink[0], ink[1], ink[2]);
      pdf.text("Recommended next steps", margin, y);
      y += 26;
      const steps = [
        "Install analytics tracking so ad spend and leads can be measured.",
        "Add a clear call to action above the fold to convert more visitors.",
        "Write a meta description so the page performs better in search results.",
      ];
      for (const [index, step] of steps.entries()) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(primary[0], primary[1], primary[2]);
        pdf.text(String(index + 1), margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(ink[0], ink[1], ink[2]);
        const lines = pdf.splitTextToSize(step, pageWidth - margin * 2 - 20) as string[];
        pdf.text(lines, margin + 16, y);
        y += lines.length * 14 + 10;
      }

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        drawFooter(page, pageCount);
      }

      const fileSafeName = displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "agency";
      pdf.save(`${fileSafeName}-sample-report.pdf`);
    } catch {
      setLogoError("Could not generate the PDF preview. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap");
        :root {
          --ink: #06110b;
          --ink2: #0d1c14;
          --paper: #f1f4ec;
          --g: #00e676;
          --gd: #067a3e;
          --red: #ff4d4f;
          --mu: #8fa699;
          --mup: #55665c;
          --line: rgba(0, 230, 118, 0.2);
        }
        :root:not([data-theme="light"]) {
          color-scheme: dark;
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
        html {
          scroll-behavior: smooth;
          scroll-padding-top: env(safe-area-inset-top, 0px);
          background: var(--ink);
        }
        body {
          margin: 0;
          background: var(--ink);
          color: #eef5f0;
          font-family: "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif;
          line-height: 1.55;
          overflow-x: hidden;
        }
        .atp a {
          color: inherit;
          text-decoration: none;
        }
        .atp a:focus-visible,
        .atp button:focus-visible,
        .atp input:focus-visible,
        .atp summary:focus-visible {
          outline: 2px solid var(--g);
          outline-offset: 3px;
        }
        .atp .w {
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 22px;
        }
        .atp .grain {
          position: relative;
        }
        .atp .grain::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.09;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .atp .grain > * {
          position: relative;
        }
        .atp .dark {
          background: radial-gradient(800px 480px at 85% 0, rgba(0, 230, 118, 0.17), transparent 65%), var(--ink);
        }
        .atp .paper {
          background: var(--paper);
          color: #0b1a12;
        }
        .atp .paper .mu {
          color: var(--mup);
        }
        .atp section {
          padding: 90px 0;
        }
        .atp h1,
        .atp h2,
        .atp h3 {
          margin: 0;
          letter-spacing: -0.035em;
          line-height: 1.02;
        }
        .atp h1 {
          font-size: clamp(42px, 6.4vw, 78px);
          font-weight: 800;
        }
        .atp h2 {
          font-size: clamp(30px, 4.2vw, 50px);
          font-weight: 800;
          margin-bottom: 14px;
        }
        .atp h1 span {
          color: var(--g);
        }
        .atp .mu {
          color: var(--mu);
        }
        .atp .lead {
          font-size: 19px;
          max-width: 560px;
          margin: 0 0 36px;
        }
        .atp .logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 21px;
          letter-spacing: -0.02em;
        }
        .atp .logo svg {
          width: 32px;
          height: 32px;
          filter: drop-shadow(0 0 8px rgba(0, 230, 118, 0.5));
        }
        .atp .logo b {
          color: var(--g);
        }
        .atp nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
        }
        .atp nav div {
          display: flex;
          gap: 26px;
          align-items: center;
          font-size: 15px;
          color: var(--mu);
        }
        .atp .btn {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          background: var(--g);
          color: #031209;
          font: inherit;
          font-weight: 700;
          padding: 15px 28px;
          border-radius: 999px;
          border: 0;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(0, 230, 118, 0.35);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .atp .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 44px rgba(0, 230, 118, 0.55);
        }
        .atp .btn.s {
          padding: 10px 20px;
          font-size: 15px;
        }
        .atp .ln {
          font-weight: 600;
          border-bottom: 2px solid var(--g);
          padding-bottom: 2px;
        }
        .atp .hero {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 44px;
          align-items: center;
          padding: 36px 0 96px;
        }
        .atp .hero p {
          font-size: 20px;
          color: var(--mu);
          max-width: 470px;
          margin: 24px 0 32px;
        }
        .atp .acts {
          display: flex;
          gap: 22px;
          align-items: center;
          flex-wrap: wrap;
        }
        .atp .stage {
          position: relative;
        }
        .atp .site {
          position: relative;
          background: #e9edea;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
          color: #7b8782;
        }
        .atp .chrome {
          background: #cfd6d2;
          padding: 10px 14px;
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 12px;
        }
        .atp .chrome i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #9ba7a1;
        }
        .atp .chrome span {
          flex: 1;
          background: #f4f6f5;
          border-radius: 6px;
          padding: 3px 10px;
          margin-left: 6px;
        }
        .atp .pg {
          padding: 16px 20px 20px;
          height: 360px;
          position: relative;
        }
        .atp .sn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
          color: #5c6a64;
          font-size: 14px;
          margin-bottom: 22px;
        }
        .atp .sn s {
          display: flex;
          gap: 8px;
          text-decoration: none;
        }
        .atp .sn s i {
          width: 34px;
          height: 7px;
          border-radius: 4px;
          background: #c3ccc7;
        }
        .atp .sh {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 18px;
        }
        .atp .sh h4 {
          margin: 0 0 10px;
          font-size: 25px;
          line-height: 1.1;
          color: #69766f;
          font-weight: 700;
        }
        .atp .bl {
          height: 8px;
          border-radius: 4px;
          background: #cdd5d1;
          margin-bottom: 8px;
        }
        .atp .sbtn {
          display: inline-block;
          margin-top: 10px;
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 5px;
          background: #c6cec9;
          color: #8a9690;
        }
        .atp .img {
          background: linear-gradient(135deg, #c1cac5, #d8dedb);
          border-radius: 8px;
          height: 130px;
        }
        .atp .ft {
          position: absolute;
          left: 20px;
          right: 20px;
          bottom: 18px;
        }
        .atp .beam {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 3px;
          background: var(--g);
          box-shadow: 0 0 22px 6px rgba(0, 230, 118, 0.55);
          opacity: 0;
          z-index: 3;
        }
        .atp .tint {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 0;
          background: linear-gradient(180deg, rgba(0, 230, 118, 0), rgba(0, 230, 118, 0.14));
          z-index: 2;
        }
        .atp .pin {
          position: absolute;
          z-index: 4;
          opacity: 0;
          transform: translateY(6px);
          display: flex;
          gap: 7px;
          align-items: flex-start;
        }
        .atp .pin::before {
          content: "";
          flex: none;
          width: 14px;
          height: 14px;
          margin-top: 3px;
          border-radius: 50%;
          background: var(--red);
          box-shadow: 0 0 0 5px rgba(255, 77, 79, 0.3);
        }
        .atp .pin b {
          display: block;
          font-size: 12px;
          line-height: 1.25;
          background: #0a1710;
          color: #fff;
          border-radius: 9px;
          padding: 7px 10px;
          max-width: 150px;
          font-weight: 600;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
        }
        .atp .pin b small {
          display: block;
          color: #ff9a9b;
          font-weight: 500;
        }
        .atp .pin.r {
          flex-direction: row-reverse;
          text-align: right;
        }
        .atp .stamp {
          position: absolute;
          right: -14px;
          bottom: -26px;
          z-index: 5;
          background: var(--g);
          color: #031209;
          border-radius: 18px;
          padding: 12px 18px;
          transform: rotate(4deg) scale(0.6);
          opacity: 0;
          box-shadow: 0 20px 44px rgba(0, 230, 118, 0.4);
        }
        .atp .stamp b {
          font-size: 38px;
          line-height: 1;
          display: block;
          font-weight: 800;
        }
        .atp .stamp span {
          font-size: 12px;
          font-weight: 600;
        }
        .atp .run .beam {
          animation: sweep 3.2s ease-in-out forwards;
        }
        .atp .run .tint {
          animation: tn 3.2s ease-in-out forwards;
        }
        .atp .run .pin {
          animation: pop 0.45s forwards;
          animation-delay: var(--t);
        }
        .atp .run .stamp {
          animation: st 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) 3.3s forwards;
        }
        @keyframes sweep {
          0% {
            top: 0;
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes tn {
          0% {
            height: 0;
            opacity: 1;
          }
          100% {
            height: 100%;
            opacity: 0;
          }
        }
        @keyframes pop {
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes st {
          to {
            opacity: 1;
            transform: rotate(4deg) scale(1);
          }
        }
        .atp .rep {
          margin-top: 44px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: rgba(0, 230, 118, 0.1);
          color: var(--g);
          font: inherit;
          font-weight: 700;
          font-size: 18px;
          padding: 16px 30px;
          border-radius: 999px;
          border: 2px solid var(--g);
          cursor: pointer;
          box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.5), inset 0 0 20px rgba(0, 230, 118, 0.12);
          animation: pulse 2.4s ease-out infinite;
          transition: background 0.15s, color 0.15s, transform 0.15s;
        }
        .atp .rep svg {
          width: 22px;
          height: 22px;
          transition: transform 0.5s;
        }
        .atp .rep:hover {
          background: var(--g);
          color: #031209;
          transform: translateY(-2px) scale(1.03);
        }
        .atp .rep:hover svg {
          transform: rotate(-360deg);
        }
        .atp .rep:active {
          transform: scale(0.96);
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.5), inset 0 0 20px rgba(0, 230, 118, 0.12);
          }
          70%,
          100% {
            box-shadow: 0 0 0 18px rgba(0, 230, 118, 0), inset 0 0 20px rgba(0, 230, 118, 0.12);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .atp .rep {
            animation: none;
          }
        }
        .atp .race {
          display: grid;
          gap: 22px;
          max-width: 820px;
        }
        .atp .lane b {
          display: block;
          font-size: 17px;
          margin-bottom: 8px;
        }
        .atp .track {
          height: 52px;
          border-radius: 12px;
          background: #dfe6dc;
          position: relative;
          overflow: hidden;
        }
        .atp .track i {
          position: absolute;
          inset: 0 auto 0 0;
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-weight: 700;
          white-space: nowrap;
          border-radius: 12px;
        }
        .atp .t1 i {
          width: 100%;
          background: #1b2a22;
          color: #cfe0d6;
        }
        .atp .t2 i {
          width: 3.5%;
          min-width: 18px;
          background: var(--g);
          padding: 0;
        }
        .atp .lane small {
          display: block;
          margin-top: 8px;
          color: var(--mup);
          font-size: 15px;
        }
        .atp .route {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          counter-reset: r;
        }
        .atp .route li {
          position: relative;
          padding: 26px 18px 28px 0;
          border-top: 2px solid var(--line);
        }
        .atp .route li::before {
          counter-increment: r;
          content: counter(r);
          position: absolute;
          top: -17px;
          left: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--g);
          color: #031209;
          font-weight: 800;
          display: grid;
          place-items: center;
        }
        .atp .route h3 {
          font-size: 19px;
          margin: 6px 0 6px;
          letter-spacing: -0.02em;
        }
        .atp .route p {
          margin: 0;
          color: var(--mu);
          font-size: 15px;
        }
        .atp .route li:nth-child(n + 5) {
          margin-top: 30px;
        }
        .atp .two {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 56px;
          align-items: center;
        }
        .atp .nm {
          display: flex;
          gap: 10px;
          margin: 0 0 22px;
          max-width: 420px;
        }
        .atp .nm input {
          flex: 1;
          min-width: 0;
          font: inherit;
          font-weight: 600;
          padding: 14px 16px;
          border-radius: 12px;
          border: 2px solid #0b1a12;
          background: #fff;
          color: #0b1a12;
        }
        .atp .doc {
          background: #fff;
          border-radius: 6px;
          box-shadow: 0 30px 60px rgba(8, 30, 18, 0.25), 0 2px 0 #cfd8cf;
          padding: 0;
          overflow: hidden;
          color: #0b1a12;
          font-size: 13px;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
          transform: rotate(1.2deg);
          max-width: 100%;
        }
        .atp .dh {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 22px;
          background: #0b1a12;
          color: #fff;
        }
        .atp .dh em {
          font-style: normal;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: var(--brand-primary, var(--g));
          color: #031209;
          display: grid;
          place-items: center;
          font-weight: 800;
          flex: none;
        }
        .atp .brandLogo {
          height: 34px;
          width: auto;
          max-width: 110px;
          object-fit: contain;
          border-radius: 6px;
          background: #fff;
          padding: 3px 6px;
          flex: none;
        }
        .atp .dh b {
          font-size: 16px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .atp .dh span {
          font-size: 11px;
          color: #9bb3a5;
        }
        .atp .db {
          padding: 20px 22px;
        }
        .atp .dsc {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-bottom: 12px;
        }
        .atp .dsc strong {
          font-size: 44px;
          line-height: 1;
          color: var(--brand-secondary, var(--gd));
        }
        .atp .rw {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e1e8e1;
        }
        .atp .tg {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 99px;
        }
        .atp .ps {
          background: #d3f5e2;
          color: var(--brand-secondary, var(--gd));
        }
        .atp .fl {
          background: #ffdcdc;
          color: #b4202a;
        }
        .atp .pt {
          margin-top: 14px;
          padding: 12px 14px;
          background: #ecf7f0;
          border-left: 4px solid var(--brand-primary, var(--g));
          line-height: 1.5;
        }
        .atp .docFooter {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 22px;
          border-top: 1px solid #e1e8e1;
          font-size: 11px;
          color: #55665c;
        }
        .atp .brandLogoSmall {
          height: 18px;
          width: auto;
          max-width: 70px;
          object-fit: contain;
          flex: none;
        }
        .atp .brandMark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          color: #031209;
          font-weight: 800;
          font-size: 10px;
          flex: none;
        }
        .atp .brandControls {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          align-items: flex-start;
          max-width: 420px;
          margin: 0 0 22px;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .atp .fileField {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--mu);
        }
        .atp .fileField input[type="file"] {
          font: inherit;
          font-size: 12px;
          color: var(--mu);
          max-width: 220px;
        }
        .atp .colorFields {
          display: flex;
          gap: 16px;
        }
        .atp .colorFields label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--mu);
        }
        .atp .colorFields input[type="color"] {
          width: 52px;
          height: 34px;
          padding: 2px;
          border-radius: 8px;
          border: 2px solid #0b1a12;
          background: #fff;
          cursor: pointer;
        }
        .atp .brandError {
          flex-basis: 100%;
          margin: 0;
          font-size: 12px;
          color: var(--red);
        }
        .atp .btn.ghost {
          background: transparent;
          color: var(--g);
          border: 2px solid var(--g);
          box-shadow: none;
          margin-left: 12px;
        }
        .atp .btn.ghost:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .atp .calc {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
          align-items: center;
        }
        .atp .big {
          font-size: 72px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          color: var(--g);
        }
        .atp input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 10px;
          border-radius: 10px;
          background: linear-gradient(90deg, var(--g) var(--p, 30%), #22352a var(--p, 30%));
          margin: 22px 0 8px;
        }
        .atp input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--g);
          border: 5px solid var(--ink);
          box-shadow: 0 0 18px var(--g);
          cursor: pointer;
        }
        .atp input[type="range"]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--g);
          border: 5px solid var(--ink);
          cursor: pointer;
        }
        .atp .ends {
          display: flex;
          justify-content: space-between;
          color: var(--mu);
          font-size: 13px;
        }
        .atp .o {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 15px 0;
          border-bottom: 1px solid var(--line);
        }
        .atp .o span {
          color: var(--mu);
        }
        .atp .o b {
          font-size: 28px;
        }
        .atp .o.n b {
          font-size: 44px;
          color: var(--g);
        }
        .atp .pr {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          max-width: 800px;
        }
        .atp .pl {
          padding: 32px;
          border-radius: 24px;
          border: 2px solid #0b1a12;
          background: #fff;
        }
        .atp .pl.h {
          background: #0b1a12;
          color: #fff;
          border-color: #0b1a12;
          box-shadow: 0 0 0 6px rgba(0, 230, 118, 0.35);
        }
        .atp .pl h3 {
          font-size: 22px;
        }
        .atp .am {
          font-size: 60px;
          font-weight: 800;
          letter-spacing: -0.04em;
          margin: 6px 0 14px;
        }
        .atp .am small {
          font-size: 16px;
          font-weight: 400;
          opacity: 0.7;
        }
        .atp .pl ul {
          list-style: none;
          margin: 0 0 26px;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        .atp .pl li::before {
          content: "✔";
          color: var(--g);
          margin-right: 10px;
        }
        .atp .pl:not(.h) li::before {
          color: var(--gd);
        }
        .atp .pl .btn {
          width: 100%;
        }
        .atp .pl:not(.h) .btn {
          background: #0b1a12;
          color: #fff;
          box-shadow: none;
        }
        .atp details {
          border-bottom: 1px solid var(--line);
          padding: 18px 0;
          max-width: 740px;
        }
        .atp summary {
          cursor: pointer;
          font-size: 19px;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          list-style: none;
        }
        .atp summary::after {
          content: "+";
          color: var(--g);
          font-size: 26px;
          line-height: 1;
        }
        .atp details[open] summary::after {
          content: "\\2013";
        }
        .atp details p {
          margin: 10px 0 0;
          color: var(--mu);
        }
        .atp .end {
          text-align: center;
          padding: 110px 22px;
        }
        .atp .end h2 {
          font-size: clamp(34px, 5.4vw, 66px);
          max-width: 780px;
          margin: 0 auto 20px;
        }
        .atp .end p {
          max-width: 480px;
          margin: 0 auto 32px;
          font-size: 19px;
        }
        .atp footer {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 30px 0;
          color: var(--mu);
          font-size: 14px;
        }
        @media (max-width: 900px) {
          .atp .hero,
          .atp .two,
          .atp .calc {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .atp .route {
            grid-template-columns: 1fr 1fr;
          }
          .atp .route li:nth-child(n + 3) {
            margin-top: 30px;
          }
          .atp .pr {
            grid-template-columns: 1fr;
          }
          .atp nav div a:not(.btn) {
            display: none;
          }
          .atp .pg {
            height: 340px;
          }
        }
        @media (max-width: 520px) {
          .atp .pin b {
            max-width: 118px;
            font-size: 11px;
          }
          .atp .sh h4 {
            font-size: 20px;
          }
          .atp .route {
            grid-template-columns: 1fr;
          }
          .atp .route li:nth-child(n + 2) {
            margin-top: 30px;
          }
          .atp .big {
            font-size: 56px;
          }
          .atp .stamp {
            right: -4px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .atp html {
            scroll-behavior: auto;
          }
          .atp .pin,
          .atp .stamp {
            opacity: 1;
            transform: none;
            animation: none !important;
          }
          .atp .stamp {
            transform: rotate(4deg);
          }
          .atp .beam,
          .atp .tint {
            display: none;
          }
        }
      `}</style>

      <div className="atp">
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <symbol id="lg" viewBox="0 0 64 64">
              <g fill="none" stroke="#00E676" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 20V14a9 9 0 0 1 9-9h6" />
                <path d="M44 5h6a9 9 0 0 1 9 9v6" />
                <path d="M5 44v6a9 9 0 0 0 9 9h6" />
                <path d="M44 59h6a9 9 0 0 0 9-9v-6" />
              </g>
              <path d="M23 19l22 13-22 13z" fill="#1de9a0" stroke="#1de9a0" strokeWidth={4} strokeLinejoin="round" />
              <path d="M47 12l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#b6ff8f" />
            </symbol>
          </defs>
        </svg>

        <div className="dark grain" id="top">
          <div className="w">
            <nav>
              <a className="logo" href="#top">
                <svg>
                  <use href="#lg" />
                </svg>
                <span>
                  AuditToPitch<b>Pro</b>
                </span>
              </a>
              <div>
                <a href="#route">How it works</a>
                <a href="#roi">ROI</a>
                <a href="#pricing">Pricing</a>
                <a className="btn s" href="/signup">
                  Get started
                </a>
              </div>
            </nav>
            <div className="hero">
              <div>
                <h1>
                  Find what&apos;s broken. <span>Get paid to fix it.</span>
                </h1>
                <p>
                  Turn any prospect&apos;s website into a $500 audit report and a ready-to-record pitch script in 10
                  seconds. Whitelabeled with your agency name.
                </p>
                <div className="acts">
                  <a className="btn" href="/signup">
                    Start winning clients
                  </a>
                  <a className="ln" href="#report">
                    See the report
                  </a>
                </div>
              </div>
              <div className={`stage ${isScanning ? "run" : ""}`} id="stage">
                <div
                  className="site"
                  role="img"
                  aria-label="A generic dental website being scanned, with five issues flagged and a health score of 62 out of 100"
                >
                  <div className="chrome">
                    <i></i>
                    <i></i>
                    <i></i>
                    <span>brightside-dental.com</span>
                  </div>
                  <div className="pg">
                    <div className="sn">
                      Brightside Dental
                      <s>
                        <i></i>
                        <i></i>
                        <i></i>
                      </s>
                    </div>
                    <div className="sh">
                      <div>
                        <h4>Quality Service For Your Needs</h4>
                        <div className="bl" style={{ width: "92%" }}></div>
                        <div className="bl" style={{ width: "70%" }}></div>
                        <span className="sbtn">Learn more</span>
                      </div>
                      <div className="img"></div>
                    </div>
                    <div className="ft">
                      <div className="bl" style={{ width: "40%" }}></div>
                      <div className="bl" style={{ width: "25%" }}></div>
                    </div>
                    <div className="tint"></div>
                    <div className="beam"></div>
                    <div className="pin" style={{ "--t": ".45s", left: "14px", top: "8px" } as CSSVars}>
                      <b>
                        No analytics pixel
                        <small>Flying blind on ad spend</small>
                      </b>
                    </div>
                    <div className="pin" style={{ "--t": "1.1s", left: "14px", top: "112px" } as CSSVars}>
                      <b>
                        Vague headline
                        <small>No offer, no reason to call</small>
                      </b>
                    </div>
                    <div className="pin r" style={{ "--t": "1.5s", right: "14px", top: "150px" } as CSSVars}>
                      <b>
                        Hero image 3.4 MB
                        <small>Slow on mobile</small>
                      </b>
                    </div>
                    <div className="pin" style={{ "--t": "2.1s", left: "20px", top: "196px" } as CSSVars}>
                      <b>
                        Weak call to action
                        <small>About 9 leads lost a month</small>
                      </b>
                    </div>
                    <div className="pin r" style={{ "--t": "2.8s", right: "14px", bottom: "44px" } as CSSVars}>
                      <b>
                        No meta description
                        <small>Invisible in search</small>
                      </b>
                    </div>
                  </div>
                </div>
                <div className="stamp">
                  <b>62</b>
                  <span>/100 · $4,500+ on the table</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", paddingBottom: "50px" }}>
              <button className="rep" id="rep" type="button" onClick={replayScan}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
                Scan it again
              </button>
            </div>
          </div>
        </div>

        <section className="paper">
          <div className="w">
            <h2>The audit used to eat your afternoon.</h2>
            <p className="lead mu">
              Checking tags, testing speed, taking screenshots, then writing something that doesn&apos;t sound like
              spam. Here is the same job, two ways.
            </p>
            <div className="race">
              <div className="lane">
                <b>By hand</b>
                <div className="track t1">
                  <i>About 90 minutes</i>
                </div>
                <small>Six tabs, a spreadsheet and a blank email.</small>
              </div>
              <div className="lane">
                <b>With AuditToPitch Pro</b>
                <div className="track t2">
                  <i></i>
                </div>
                <small>10 seconds. Score, issues, PDF and script, done.</small>
              </div>
            </div>
          </div>
        </section>

        <section className="dark grain" id="route">
          <div className="w">
            <h2>Eight steps from stranger to signed.</h2>
            <p className="lead mu">The same route every time, so winning clients stops depending on luck.</p>
            <ol className="route">
              <li>
                <h3>Find a weak site</h3>
                <p>A business with a generic website that needs help.</p>
              </li>
              <li>
                <h3>Click the extension</h3>
                <p>One click in Chrome starts the audit.</p>
              </li>
              <li>
                <h3>Deep scan</h3>
                <p>SEO, pixels, speed and page structure checked together.</p>
              </li>
              <li>
                <h3>Read the score</h3>
                <p>A health score, the issues and what fixing them is worth.</p>
              </li>
              <li>
                <h3>Generate the pitch</h3>
                <p>An AI-written Loom script, built from the findings.</p>
              </li>
              <li>
                <h3>Record your Loom</h3>
                <p>Show the problems, explain the cost, offer the fix.</p>
              </li>
              <li>
                <h3>Send it</h3>
                <p>Email the video and the PDF to your prospect.</p>
              </li>
              <li>
                <h3>Close and retain</h3>
                <p>They book a call, sign, and stay on retainer.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="paper" id="report">
          <div className="w two">
            <div>
              <h2>A report that looks like your agency made it.</h2>
              <p className="lead mu" style={{ marginBottom: "24px" }}>
                Type your agency name, drop in your logo and brand colors, and watch the PDF rebrand itself. Every
                report is two pages and ready to send.
              </p>
              <div className="nm">
                <input
                  id="ag"
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  maxLength={28}
                  aria-label="Your agency name"
                />
              </div>
              <div className="brandControls">
                <label className="fileField">
                  <span>Agency logo (SVG or PNG, max 2MB)</span>
                  <input type="file" accept=".svg,.png,image/svg+xml,image/png" onChange={handleLogoUpload} />
                </label>
                <div className="colorFields">
                  <label>
                    Primary
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      aria-label="Primary brand color"
                    />
                  </label>
                  <label>
                    Secondary
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      aria-label="Secondary brand color"
                    />
                  </label>
                </div>
                {logoError && <p className="brandError">{logoError}</p>}
              </div>
              <a className="btn" href="/signup">
                Make my first report
              </a>
              <button type="button" className="btn ghost" onClick={generateReportPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? "Preparing PDF..." : "Download PDF preview"}
              </button>
            </div>
            <div className="doc" style={{ "--brand-primary": primaryColor, "--brand-secondary": secondaryColor } as CSSVars}>
              <div className="dh">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt={`${displayName} logo`} className="brandLogo" />
                ) : (
                  <em id="ai">{initial}</em>
                )}
                <b id="an">{displayName}</b>
                <span>Website audit</span>
              </div>
              <div className="db">
                <div className="dsc">
                  <strong>62</strong>
                  <div>
                    Health score for brightside-dental.com
                    <br />
                    <span style={{ color: "#55665c" }}>12 issues · about 23 missed leads a month</span>
                  </div>
                </div>
                <div className="rw">
                  Analytics pixel<span className="tg fl">FAIL</span>
                </div>
                <div className="rw">
                  Call to action<span className="tg fl">FAIL</span>
                </div>
                <div className="rw">
                  Meta description<span className="tg fl">FAIL</span>
                </div>
                <div className="rw">
                  Page structure<span className="tg ps">PASS</span>
                </div>
                <div className="pt">
                  <b>Pitch script:</b> &quot;Hi John, I&apos;m from <span id="ap">{displayName}</span>. I audited your
                  website and found several things that are likely costing you customers…&quot;
                </div>
              </div>
              <div className="docFooter">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="" className="brandLogoSmall" />
                ) : (
                  <span className="brandMark" style={{ background: primaryColor }}>
                    {initial}
                  </span>
                )}
                <span>{displayName} · Confidential report</span>
              </div>
            </div>
          </div>
        </section>

        <section className="dark grain" id="roi">
          <div className="w">
            <h2>Do the math on your own month.</h2>
            <p className="lead mu">A manual audit takes about 1.5 hours. Slide to how many you send.</p>
            <div className="calc">
              <div>
                <label htmlFor="n" style={{ fontSize: "18px", fontWeight: 600 }}>
                  Prospect sites audited per month
                </label>
                <div className="big" style={{ marginTop: "14px" }}>
                  <span id="nv">{audits}</span>
                </div>
                <input
                  id="n"
                  type="range"
                  min={5}
                  max={50}
                  value={audits}
                  onChange={(e) => setAudits(Number(e.target.value))}
                  style={{ "--p": `${percent}%` } as CSSVars}
                />
                <div className="ends">
                  <span>5</span>
                  <span>50</span>
                </div>
              </div>
              <div aria-live="polite">
                <div className="o">
                  <span>Hours saved</span>
                  <b id="h">{hours} hrs</b>
                </div>
                <div className="o">
                  <span>That time at $50 an hour</span>
                  <b id="v">{fmt(value)}</b>
                </div>
                <div className="o">
                  <span>Pro plan</span>
                  <b>$39</b>
                </div>
                <div className="o n">
                  <span>You keep</span>
                  <b id="net">{fmt(net)}</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="paper" id="pricing">
          <div className="w">
            <h2>Cheaper than one hour of your time.</h2>
            <p className="lead mu">Two plans. Cancel whenever.</p>
            <div className="pr">
              <div className="pl">
                <h3>Starter</h3>
                <div className="am">
                  $0<small> / month</small>
                </div>
                <ul>
                  <li>3 full website audits</li>
                  <li>Instant health score</li>
                  <li>Branded PDF report</li>
                </ul>
                <a className="btn" href="/signup?plan=starter">
                  Choose Starter
                </a>
              </div>
              <div className="pl h">
                <h3>Pro</h3>
                <div className="am">
                  $39<small> / month</small>
                </div>
                <ul>
                  <li>Everything in Starter</li>
                  <li>Whitelabel PDF with your logo</li>
                  <li>AI Loom scripts</li>
                  <li>Cold email drafts</li>
                </ul>
                <a className="btn" href="/signup?plan=pro">
                  Choose Pro
                </a>
              </div>
            </div>
            <div style={{ height: "60px" }}></div>
            <h2 style={{ fontSize: "32px" }}>Questions</h2>
            <div style={{ height: "12px" }}></div>
            <div style={{ color: "#0b1a12" }}>
              <details>
                <summary>How do I run an audit?</summary>
                <p style={{ color: "#55665c" }}>
                  Open a prospect&apos;s site, click the extension in Chrome and press Activate Audit.
                </p>
              </details>
              <details>
                <summary>What does it check?</summary>
                <p style={{ color: "#55665c" }}>
                  Meta tags, analytics pixels, image speed, SEO, page structure and calls to action.
                </p>
              </details>
              <details>
                <summary>Can I use my own branding?</summary>
                <p style={{ color: "#55665c" }}>Yes. Pro reports carry your agency name and logo.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="dark grain end">
          <h2>Your next client already has a broken website.</h2>
          <p className="mu">Install the extension, scan one site, send one pitch.</p>
          <a className="btn" href="/signup">
            Get AuditToPitch Pro
          </a>
          <div className="w" style={{ marginTop: "80px" }}>
            <footer>
              <a className="logo" href="#top">
                <svg>
                  <use href="#lg" />
                </svg>
                <span>
                  AuditToPitch<b>Pro</b>
                </span>
              </a>
              <span>Audit websites. Generate pitches. Win clients.</span>
            </footer>
          </div>
        </section>
      </div>
    </>
  );
}
