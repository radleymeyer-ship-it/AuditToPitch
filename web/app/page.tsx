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
