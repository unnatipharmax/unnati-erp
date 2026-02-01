(function () {
  const region = document.querySelector("#SS_KANBAN_TemplateComponentContainer");
  if (!region) return;

  const PREF_NAME = "SS_KANBAN_COL_STATE_P8"; // change P8 to your page id

  // ---- Helpers
  function colKeyFromTitle(title) {
    return (title || "").trim();
  }

  function getCols() {
    return Array.from(region.querySelectorAll(".kb-col"));
  }

  function ensureHeaderUI(col) {
    const header = col.querySelector(".kb-col-inner-header");
    if (!header) return;

    const titleEl = header.querySelector(".title");
    if (!titleEl) return;

    if (header.querySelector(".ss-kb-tools")) return;

    const tools = document.createElement("div");
    tools.className = "ss-kb-tools";

    const count = document.createElement("span");
    count.className = "ss-kb-count";
    count.textContent = "(0)";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ss-kb-collapse";
    btn.setAttribute("aria-label", "Collapse lane");
    btn.innerHTML = "⟨"; // simple icon; you can replace with SVG/font icon

    tools.appendChild(count);
    tools.appendChild(btn);

    header.classList.add("ss-kb-header");

    header.appendChild(tools);

    col.dataset.colKey = colKeyFromTitle(titleEl.textContent);
  }

  function updateCounts() {
    getCols().forEach(col => {
      const container = col.querySelector(".kb-item-container");
      const countEl = col.querySelector(".ss-kb-count");
      if (!container || !countEl) return;

      const cards = container.querySelectorAll(".kb-card");
      countEl.textContent = `(${cards.length})`;
    });
  }

  function applyCollapseState(stateMap) {
    getCols().forEach(col => {
      const key = col.dataset.colKey || "";
      if (!key) return;

      const collapsed = stateMap && stateMap[key] === "Y";
      col.classList.toggle("ss-kb-collapsed", collapsed);

      const btn = col.querySelector(".ss-kb-collapse");
      if (btn) btn.innerHTML = collapsed ? "⟩" : "⟨";
    });
  }

  function bindCollapseHandlers(stateMap) {
    getCols().forEach(col => {
      const btn = col.querySelector(".ss-kb-collapse");
      if (!btn || btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const key = col.dataset.colKey || "";
        if (!key) return;

        const nowCollapsed = !col.classList.contains("ss-kb-collapsed");
        col.classList.toggle("ss-kb-collapsed", nowCollapsed);
        btn.innerHTML = nowCollapsed ? "⟩" : "⟨";

        stateMap[key] = nowCollapsed ? "Y" : "N";

        apex.server.process(
          "SAVE_KANBAN_COL_STATE",
          { x01: PREF_NAME, x02: JSON.stringify(stateMap) },
          { dataType: "text" }
        );
      });
    });
  }

  apex.server.process(
    "GET_KANBAN_COL_STATE",
    { x01: PREF_NAME },
    {
      dataType: "json",
      success: function (data) {
        let stateMap = {};
        try {
          stateMap = data && data.value ? JSON.parse(data.value) : {};
        } catch (e) {
          stateMap = {};
        }

        getCols().forEach(col => ensureHeaderUI(col));

        applyCollapseState(stateMap);

        bindCollapseHandlers(stateMap);

        updateCounts();

        const observer = new MutationObserver(() => updateCounts());
        observer.observe(region, { childList: true, subtree: true });
      }
    }
  );
})();
