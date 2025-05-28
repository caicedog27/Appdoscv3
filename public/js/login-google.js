(function () {
  "use strict";

  if (!window.googleAuthConfig) {
    console.error("Sin googleAuthConfig");
    return;
  }

  const { clientId } = googleAuthConfig;
  const btn       = document.getElementById("googleLoginBtn");
  const errorBox  = document.getElementById("loginError");

  const showMsg = (msg, cls = "danger") => {
    errorBox.textContent = msg;
    errorBox.className = `alert alert-${cls} mt-3`;
    errorBox.classList.remove("d-none");
  };
  const hideMsg = () => errorBox.classList.add("d-none");

  const spin = {
    show() {
      this.el ||= (() => {
        const d = document.createElement("div");
        d.className = "position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center";
        d.style.background = "rgba(255,255,255,.7)";
        d.innerHTML = '<div class="spinner-border text-danger" style="width:3rem;height:3rem;"></div>';
        return d;
      })();
      document.body.appendChild(this.el);
    },
    hide() { this.el?.remove(); }
  };

  const sendCode = async (code) => {
    spin.show();
    try {
      const resp = await fetch("/auth/google/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "include"               // ←  guarda la cookie!
      });

      if (resp.redirected) {
        window.location.href = resp.url;
        return;
      }

      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const to = data.redirect || "/";
        showMsg("¡Sesión iniciada! Redirigiendo…", "success");
        setTimeout(() => (window.location.href = to), 800);
        return;
      }

      const txt = await resp.text();
      throw new Error(txt || resp.status);
    } catch (err) {
      showMsg("Error: " + err.message);
    } finally {
      spin.hide();
    }
  };

  let codeClient;
  window.onload = () => {
    codeClient = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "openid email profile",
      ux_mode: "popup",
      callback: (resp) => {
        resp.code ? sendCode(resp.code) : showMsg("Autorización cancelada.");
      }
    });

    btn?.addEventListener("click", () => {
      hideMsg();
      codeClient.requestCode();
    });

    /* ¿Venimos de redirect? */
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      history.replaceState({}, "", url.origin + url.pathname);
      sendCode(code);
    }
  };
})();
