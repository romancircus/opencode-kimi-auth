// src/ui/code.tsx
import { UnknownStateError } from "../error.js";
import { Layout } from "./base.js";
import { FormAlert } from "./form.js";
import { jsxDEV } from "hono/jsx/jsx-dev-runtime";
var DEFAULT_COPY = {
  email_placeholder: "Email",
  email_invalid: "Email address is not valid",
  button_continue: "Continue",
  code_info: "We'll send a pin code to your email.",
  code_placeholder: "Code",
  code_invalid: "Invalid code",
  code_sent: "Code sent to ",
  code_resent: "Code resent to ",
  code_didnt_get: "Didn't get code?",
  code_resend: "Resend"
};
function CodeUI(props) {
  const copy = {
    ...DEFAULT_COPY,
    ...props.copy
  };
  const mode = props.mode ?? "email";
  return {
    sendCode: props.sendCode,
    length: 6,
    request: async (_req, state, _form, error) => {
      if (state.type === "start") {
        const jsx = /* @__PURE__ */ jsxDEV(Layout, {
          children: [
            /* @__PURE__ */ jsxDEV("form", {
              "data-component": "form",
              method: "post",
              children: [
                error?.type === "invalid_claim" && /* @__PURE__ */ jsxDEV(FormAlert, {
                  message: copy.email_invalid
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("input", {
                  type: "hidden",
                  name: "action",
                  value: "request"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("input", {
                  "data-component": "input",
                  autofocus: true,
                  type: mode === "email" ? "email" : "tel",
                  name: mode === "email" ? "email" : "phone",
                  inputmode: mode === "email" ? "email" : "numeric",
                  required: true,
                  placeholder: copy.email_placeholder
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("button", {
                  "data-component": "button",
                  children: copy.button_continue
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV("p", {
              "data-component": "form-footer",
              children: copy.code_info
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this);
        return new Response(jsx.toString(), {
          headers: {
            "Content-Type": "text/html"
          }
        });
      }
      if (state.type === "code") {
        const jsx = /* @__PURE__ */ jsxDEV(Layout, {
          children: [
            /* @__PURE__ */ jsxDEV("form", {
              "data-component": "form",
              class: "form",
              method: "post",
              children: [
                error?.type === "invalid_code" && /* @__PURE__ */ jsxDEV(FormAlert, {
                  message: copy.code_invalid
                }, undefined, false, undefined, this),
                state.type === "code" && /* @__PURE__ */ jsxDEV(FormAlert, {
                  message: (state.resend ? copy.code_resent : copy.code_sent) + state.claims.email,
                  color: "success"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("input", {
                  type: "hidden",
                  name: "action",
                  value: "verify"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("input", {
                  "data-component": "input",
                  autofocus: true,
                  minLength: 6,
                  maxLength: 6,
                  type: "text",
                  name: "code",
                  required: true,
                  inputmode: "numeric",
                  autocomplete: "one-time-code",
                  placeholder: copy.code_placeholder
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("button", {
                  "data-component": "button",
                  children: copy.button_continue
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV("form", {
              method: "post",
              children: [
                Object.entries(state.claims).map(([key, value]) => /* @__PURE__ */ jsxDEV("input", {
                  type: "hidden",
                  name: key,
                  value,
                  className: "hidden"
                }, key, false, undefined, this)),
                /* @__PURE__ */ jsxDEV("input", {
                  type: "hidden",
                  name: "action",
                  value: "request"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("div", {
                  "data-component": "form-footer",
                  children: /* @__PURE__ */ jsxDEV("span", {
                    children: [
                      copy.code_didnt_get,
                      " ",
                      /* @__PURE__ */ jsxDEV("button", {
                        "data-component": "link",
                        children: copy.code_resend
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this);
        return new Response(jsx.toString(), {
          headers: {
            "Content-Type": "text/html"
          }
        });
      }
      throw new UnknownStateError;
    }
  };
}
export {
  CodeUI
};
