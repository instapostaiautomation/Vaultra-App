// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Vaultra DigiGold</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
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

              /* Default / Mobile screens (< 500px): Pure native full-screen mobile view */
              body > div:first-child {
                position: fixed !important;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100% !important;
                height: 100% !important;
                background-color: #ffffff;
                display: flex;
                flex-direction: column;
                overflow: hidden;
              }

              /* Desktop / Laptop / Large screens (>= 500px): Framed in a mobile smartphone container */
              @media (min-width: 500px) {
                body {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background: radial-gradient(circle at 50% 15%, #1a202c 0%, #080a0f 100%);
                  overflow: hidden;
                }
                body > div:first-child {
                  position: relative !important;
                  top: auto !important;
                  left: auto !important;
                  right: auto !important;
                  bottom: auto !important;
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
                    0 0 35px rgba(212, 175, 55, 0.12) !important;
                  border: 2px solid rgba(255, 255, 255, 0.08) !important;
                  overflow: hidden !important;
                  background-color: #ffffff !important;
                }
              }

              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
