(async () => {
  const abs = (u, base) => { try { return new URL(u, base).href; } catch { return u; } };
  const absUrls = (css, base) => css.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) =>
    u.startsWith("data:") || u.startsWith("#") ? m : `url("${abs(u, base)}")`);
  const ruleCount = (text) => { try { const s = new CSSStyleSheet(); s.replaceSync(text); return s.cssRules.length; } catch { return -1; } };
  const fromRules = (sheet) => [...sheet.cssRules].map((r) => r.cssText).join("\n");

  // cssText turns "border: 1px solid var(--x)" into empty longhands, so prefer the tag's own text.
  // CSS-in-JS in production fills sheets with insertRule and leaves the text empty: use cssRules then.
  const sheetText = async (sheet) => {
    const node = sheet.ownerNode;
    try {
      if (node && node.tagName === "STYLE") {
        const text = node.textContent;
        if (text.trim() && ruleCount(text) === sheet.cssRules.length) return absUrls(text, location.href);
        return absUrls(fromRules(sheet), location.href);
      }
      if (sheet.href) {
        try { return absUrls(await (await fetch(sheet.href)).text(), sheet.href); }
        catch { return absUrls(fromRules(sheet), sheet.href); }
      }
      return absUrls(fromRules(sheet), location.href);
    } catch { return `/* unreadable ${sheet.href || "inline"} */`; }
  };

  window.__css = async () => (await Promise.all([...document.styleSheets].map(sheetText))).join("\n");

  window.__snap = async (name) => {
    const body = document.body.cloneNode(true);
    body.querySelectorAll("script, noscript, iframe").forEach((n) => n.remove());
    body.querySelectorAll("img[src]").forEach((img) => img.setAttribute("src", abs(img.getAttribute("src"), location.href)));
    const htmlAttrs = [...document.documentElement.attributes].map((a) => `${a.name}="${a.value}"`).join(" ");
    window.__snaps = window.__snaps || {};
    window.__snaps[name] = `<!doctype html><html ${htmlAttrs}><head><meta charset="utf-8"><title>${name}</title><style>${await window.__css()}</style></head>${body.outerHTML}</html>`;
    return `${name}: ${window.__snaps[name].length}`;
  };

  window.__download = (name) => {
    const blob = new Blob([window.__snaps[name]], { type: "text/html;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${name}.html` });
    document.body.appendChild(a); a.click(); a.remove();
    return `downloaded ${name}.html`;
  };

  window.__blockWrites = (allow) => {
    const allowed = (url) => allow && new RegExp(allow).test(url);
    window.__blocked = window.__blocked || [];
    if (!window.__origFetch) window.__origFetch = window.fetch;
    window.fetch = (input, init = {}) => {
      const method = (init.method || (input && input.method) || "GET").toUpperCase();
      const url = typeof input === "string" ? input : input.url;
      if (method === "GET" || allowed(url)) return window.__origFetch(input, init);
      window.__blocked.push(`${method} ${url}`);
      return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    };
    const proto = XMLHttpRequest.prototype;
    if (!proto.__origOpen) { proto.__origOpen = proto.open; proto.__origSend = proto.send; }
    proto.open = function (method, url, ...rest) { this.__method = method.toUpperCase(); this.__url = url; return proto.__origOpen.call(this, method, url, ...rest); };
    proto.send = function (body) {
      if (this.__method === "GET" || allowed(this.__url)) return proto.__origSend.call(this, body);
      window.__blocked.push(`${this.__method} ${this.__url}`);
      Object.defineProperty(this, "readyState", { value: 4 });
      Object.defineProperty(this, "status", { value: 200 });
      Object.defineProperty(this, "responseText", { value: "{}" });
      Object.defineProperty(this, "response", { value: "{}" });
      setTimeout(() => { this.onreadystatechange && this.onreadystatechange(); this.dispatchEvent(new Event("load")); this.dispatchEvent(new Event("loadend")); });
    };
    return "writes blocked; see window.__blocked";
  };

  // Keys: "exportedObject.method" replaces a method on an exported object. A bare "namedExport"
  // cannot be reassigned (module namespaces are read-only) - use __blockWrites for those.
  window.__fakeModule = async (path, fakes) => {
    const mod = await import(path);
    window.__originals = window.__originals || {};
    const done = [];
    for (const [key, fn] of Object.entries(fakes)) {
      const [obj, method] = key.split(".");
      if (!method) { done.push(`${key}: named export, cannot replace`); continue; }
      window.__originals[`${path}#${key}`] = window.__originals[`${path}#${key}`] || mod[obj][method];
      mod[obj][method] = fn;
      done.push(`${key}: faked`);
    }
    return done.join("; ");
  };

  window.__dropFiles = (target, names, type = "drop") => {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return "no target";
    const dt = new DataTransfer();
    names.forEach((n) => dt.items.add(new File(["demo"], n)));
    el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    return `${type} ${names.join(",")}`;
  };

  window.__findByComponent = (componentName, maxDepth = 6) => {
    for (const el of document.querySelectorAll("body *")) {
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (!key) continue;
      let fiber = el[key];
      for (let d = 0; fiber && d < maxDepth; d++, fiber = fiber.return) {
        const t = fiber.type;
        if (t && (t.displayName === componentName || t.name === componentName)) return el;
      }
    }
    return null;
  };

  return "helpers ready";
})()
