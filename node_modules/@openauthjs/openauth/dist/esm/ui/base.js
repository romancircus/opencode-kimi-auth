// src/ui/ui.css
var ui_default = `@import url("https://unpkg.com/tailwindcss@3.4.15/src/css/preflight.css");

:root {
  --color-background-dark: #0e0e11;
  --color-background-light: #ffffff;
  --color-primary-dark: #6772e5;
  --color-primary-light: #6772e5;

  --color-background-success-dark: oklch(0.3 0.04 172);
  --color-background-success-light: oklch(from var(--color-background-success-dark) 0.83 c h);
  --color-success-dark: oklch(from var(--color-background-success-dark) 0.92 c h);
  --color-success-light: oklch(from var(--color-background-success-dark) 0.25 c h);

  --color-background-error-dark: oklch(0.32 0.07 15);
  --color-background-error-light: oklch(from var(--color-background-error-dark) 0.92 c h);
  --color-error-dark: oklch(from var(--color-background-error-dark) 0.92 c h);
  --color-error-light: oklch(from var(--color-background-error-dark) 0.25 c h);

  --border-radius: 0;

  --color-background: var(--color-background-dark);
  --color-primary: var(--color-primary-dark);

  --color-background-success: var(--color-background-success-dark);
  --color-success: var(--color-success-dark);
  --color-background-error: var(--color-background-error-dark);
  --color-error: var(--color-error-dark);

  @media (prefers-color-scheme: light) {
    --color-background: var(--color-background-light);
    --color-primary: var(--color-primary-light);

    --color-background-success: var(--color-background-success-light);
    --color-success: var(--color-success-light);
    --color-background-error: var(--color-background-error-light);
    --color-error: var(--color-error-light);
  }

  --color-high: oklch(
    from var(--color-background) clamp(0, calc((l - 0.714) * -1000), 1) 0 0
  );
  --color-low: oklch(from var(--color-background) clamp(0, calc((l - 0.714) * 1000), 1) 0 0);
  --lightness-high: color-mix(
    in oklch,
    var(--color-high) 0%,
    oklch(var(--color-high) 0 0)
  );
  --lightness-low: color-mix(
    in oklch,
    var(--color-low) 0%,
    oklch(var(--color-low) 0 0)
  );
  --font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-scale: 1;

  --font-size-xs: calc(0.75rem * var(--font-scale));
  --font-size-sm: calc(0.875rem * var(--font-scale));
  --font-size-md: calc(1rem * var(--font-scale));
  --font-size-lg: calc(1.125rem * var(--font-scale));
  --font-size-xl: calc(1.25rem * var(--font-scale));
  --font-size-2xl: calc(1.5rem * var(--font-scale));
}

[data-component="root"] {
  font-family: var(--font-family);
  background-color: var(--color-background);
  padding: 1rem;
  color: white;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  user-select: none;
  color: var(--color-high);
}

[data-component="center"] {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &[data-size="small"] {
    width: 300px;
  }
}

[data-component="link"] {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  font-weight: 600;
}

[data-component="label"] {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
  font-size: var(--font-size-xs);
}

[data-component="logo"] {
  margin: 0 auto;
  height: 2.5rem;
  width: auto;
  display: none;

  @media (prefers-color-scheme: light) {
    &[data-mode="light"] {
      display: block;
    }
  }

  @media (prefers-color-scheme: dark) {
    &[data-mode="dark"] {
      display: block;
    }
  }
}

[data-component="logo-default"] {
  margin: 0 auto;
  height: 2.5rem;
  width: auto;

  @media (prefers-color-scheme: light) {
    color: var(--color-high);
  }

  @media (prefers-color-scheme: dark) {
    color: var(--color-high);
  }
}

[data-component="input"] {
  width: 100%;
  height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid transparent;
  --background: oklch(
    from var(--color-background) calc(l + (-0.06 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.03)) c h

  );
  background: var(--background);
  border-color: oklch(
    from var(--color-background)
      calc(clamp(0.22, l + (-0.12 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.06), 0.88)) c h
  );
  border-radius: calc(var(--border-radius) * 0.25rem);
  font-size: var(--font-size-sm);
  outline: none;

  &:focus {
    border-color: oklch(
      from var(--color-background)
        calc(clamp(0.3, l + (-0.2 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.1), 0.7)) c h
    );
  }

  &:user-invalid:not(:focus) {
    border-color: oklch(0.4 0.09 7.91);
  }
}

[data-component="button"] {
  height: 2.5rem;
  cursor: pointer;
  border: 0;
  font-weight: 500;
  font-size: var(--font-size-sm);
  border-radius: calc(var(--border-radius) * 0.25rem);
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: oklch(from var(--color-primary) clamp(0, calc((l - 0.714) * -1000), 1) 0 0);

  &[data-color="ghost"] {
    background: transparent;
    color: var(--color-high);
    border: 1px solid
      oklch(
        from var(--color-background)
          calc(clamp(0.22, l + (-0.12 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.06), 0.88)) c h
      );
  }

  [data-slot="icon"] {
    width: 16px;
    height: 16px;

    svg {
      width: 100%;
      height: 100%;
    }
  }
}

[data-component="form"] {
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
}

[data-component="form-alert"] {
  height: 2.5rem;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  border-radius: calc(var(--border-radius) * 0.25rem);
  background: var(--color-background-error);
  color: var(--color-error);
  text-align: left;
  font-size: 0.75rem;
  gap: 0.5rem;

  &[data-color="success"] {
    background: var(--color-background-success);
    color: var(--color-success);

    [data-slot="icon-success"] { display: block; }
    [data-slot="icon-danger"] { display: none; }
  }

  &:has([data-slot="message"]:empty) {
    display: none;
  }

  [data-slot="icon-success"],
  [data-slot="icon-danger"] {
    width: 1rem;
    height: 1rem;
  }
  [data-slot="icon-success"] { display: none; }
}

[data-component="form-footer"] {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  align-items: center;
  justify-content: center;

  &:has(> :nth-child(2)) {
    justify-content: space-between;
  }
}
`;

// src/ui/theme.ts
var THEME_OPENAUTH = {
  title: "OpenAuth",
  radius: "none",
  background: {
    dark: "black",
    light: "white"
  },
  primary: {
    dark: "white",
    light: "black"
  },
  font: {
    family: "IBM Plex Sans, sans-serif"
  },
  css: `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@100;200;300;400;500;600;700&display=swap');
  `
};
function getTheme() {
  return globalThis.OPENAUTH_THEME || THEME_OPENAUTH;
}

// src/ui/base.tsx
import { jsxDEV, Fragment } from "hono/jsx/jsx-dev-runtime";
function Layout(props) {
  const theme = getTheme();
  function get(key, mode) {
    if (!theme)
      return;
    if (!theme[key])
      return;
    if (typeof theme[key] === "string")
      return theme[key];
    return theme[key][mode];
  }
  const radius = (() => {
    if (theme?.radius === "none")
      return "0";
    if (theme?.radius === "sm")
      return "1";
    if (theme?.radius === "md")
      return "1.25";
    if (theme?.radius === "lg")
      return "1.5";
    if (theme?.radius === "full")
      return "1000000000001";
    return "1";
  })();
  const hasLogo = get("logo", "light") && get("logo", "dark");
  return /* @__PURE__ */ jsxDEV("html", {
    style: {
      "--color-background-light": get("background", "light"),
      "--color-background-dark": get("background", "dark"),
      "--color-primary-light": get("primary", "light"),
      "--color-primary-dark": get("primary", "dark"),
      "--font-family": theme?.font?.family,
      "--font-scale": theme?.font?.scale,
      "--border-radius": radius
    },
    children: [
      /* @__PURE__ */ jsxDEV("head", {
        children: [
          /* @__PURE__ */ jsxDEV("title", {
            children: theme?.title || "OpenAuthJS"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("meta", {
            charset: "utf-8"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("meta", {
            name: "viewport",
            content: "width=device-width, initial-scale=1"
          }, undefined, false, undefined, this),
          theme?.favicon ? /* @__PURE__ */ jsxDEV("link", {
            rel: "icon",
            href: theme?.favicon
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV(Fragment, {
            children: [
              /* @__PURE__ */ jsxDEV("link", {
                rel: "icon",
                href: "https://openauth.js.org/favicon.ico",
                sizes: "48x48"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("link", {
                rel: "icon",
                href: "https://openauth.js.org/favicon.svg",
                media: "(prefers-color-scheme: light)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("link", {
                rel: "icon",
                href: "https://openauth.js.org/favicon-dark.svg",
                media: "(prefers-color-scheme: dark)"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("link", {
                rel: "shortcut icon",
                href: "https://openauth.js.org/favicon.svg",
                type: "image/svg+xml"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV("style", {
            dangerouslySetInnerHTML: { __html: ui_default }
          }, undefined, false, undefined, this),
          theme?.css && /* @__PURE__ */ jsxDEV("style", {
            dangerouslySetInnerHTML: { __html: theme.css }
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("body", {
        children: /* @__PURE__ */ jsxDEV("div", {
          "data-component": "root",
          children: /* @__PURE__ */ jsxDEV("div", {
            "data-component": "center",
            "data-size": props.size,
            children: [
              hasLogo ? /* @__PURE__ */ jsxDEV(Fragment, {
                children: [
                  /* @__PURE__ */ jsxDEV("img", {
                    "data-component": "logo",
                    src: get("logo", "light"),
                    "data-mode": "light"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV("img", {
                    "data-component": "logo",
                    src: get("logo", "dark"),
                    "data-mode": "dark"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this) : ICON_OPENAUTH,
              props.children
            ]
          }, undefined, true, undefined, this)
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var ICON_OPENAUTH = /* @__PURE__ */ jsxDEV("svg", {
  "data-component": "logo-default",
  width: "51",
  height: "51",
  viewBox: "0 0 51 51",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  children: /* @__PURE__ */ jsxDEV("path", {
    d: "M0 50.2303V0.12854H50.1017V50.2303H0ZM3.08002 11.8326H11.7041V3.20856H3.08002V11.8326ZM14.8526 11.8326H23.4766V3.20856H14.8526V11.8326ZM26.5566 11.8326H35.1807V3.20856H26.5566V11.8326ZM38.3292 11.8326H47.0217V3.20856H38.3292V11.8326ZM3.08002 23.6052H11.7041V14.9811H3.08002V23.6052ZM14.8526 23.6052H23.4766V14.9811H14.8526V23.6052ZM26.5566 23.6052H35.1807V14.9811H26.5566V23.6052ZM38.3292 23.6052H47.0217V14.9811H38.3292V23.6052ZM3.08002 35.3092H11.7041V26.6852H3.08002V35.3092ZM14.8526 35.3092H23.4766V26.6852H14.8526V35.3092ZM26.5566 35.3092H35.1807V26.6852H26.5566V35.3092ZM38.3292 35.3092H47.0217V26.6852H38.3292V35.3092ZM3.08002 47.1502H11.7041V38.3893H3.08002V47.1502ZM14.8526 47.1502H23.4766V38.3893H14.8526V47.1502ZM26.5566 47.1502H35.1807V38.3893H26.5566V47.1502ZM38.3292 47.1502H47.0217V38.3893H38.3292V47.1502Z",
    fill: "currentColor"
  }, undefined, false, undefined, this)
}, undefined, false, undefined, this);
export {
  Layout
};
