const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "dist", "index.html");

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");

  // Ensure title
  html = html.replace(/<title>.*?<\/title>/i, "<title>Vaultra DigiGold</title>");

  const mobileFrameStyles = `
    <style id="mobile-frame-responsive">
      * {
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }
      html, body {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        background-color: #0b0e14;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      #root {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: #ffffff;
      }
      /* On Desktop / PC / Laptop screens (>= 500px): center inside an iPhone/Android mock container */
      @media (min-width: 500px) {
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle at 50% 15%, #1a202c 0%, #080a0f 100%);
          overflow: hidden;
        }
        #root {
          width: 100% !important;
          max-width: 420px !important;
          height: 92vh !important;
          max-height: 890px !important;
          margin: auto !important;
          border-radius: 40px !important;
          box-shadow:
            0 25px 60px -10px rgba(0, 0, 0, 0.9),
            0 0 0 10px #161922,
            0 0 0 12px #2d3444,
            0 0 35px rgba(212, 175, 55, 0.15) !important;
          border: 2px solid rgba(255, 255, 255, 0.08) !important;
          overflow: hidden !important;
          position: relative !important;
        }
      }
    </style>
  `;

  if (!html.includes('id="mobile-frame-responsive"')) {
    html = html.replace("</head>", `${mobileFrameStyles}\n</head>`);
    fs.writeFileSync(indexPath, html, "utf8");
    console.log("Successfully injected mobile-frame styling into dist/index.html");
  }
}
