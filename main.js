"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TNViewPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var TNViewPlugin = class extends import_obsidian.Plugin {
  onload() {
    return __async(this, null, function* () {
      this.registerMarkdownCodeBlockProcessor("tn-view", (source, el, ctx) => __async(this, null, function* () {
        try {
          const filter = (0, import_obsidian.parseYaml)(source) || {};
          const tasks = yield this.getFilteredTasks(filter);
          yield this.renderAsInline(tasks, el, filter, ctx.sourcePath);
        } catch (e) {
          el.createEl("div", { text: "TN-View: Invalid filter syntax" });
        }
      }));
    });
  }
  getFilteredTasks(filter) {
    return __async(this, null, function* () {
      var _a;
      const files = this.app.vault.getMarkdownFiles();
      const tasks = [];
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const weekLater = /* @__PURE__ */ new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      const weekStr = weekLater.toISOString().split("T")[0];
      for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!(cache == null ? void 0 : cache.frontmatter)) continue;
        const fm = cache.frontmatter;
        if (!fm.status) continue;
        if (filter.status && fm.status !== filter.status) continue;
        if (filter.project) {
          const raw = fm.projects;
          if (!raw) continue;
          const projects = Array.isArray(raw) ? raw : [raw];
          const needle = filter.project.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
          const match = projects.some(
            (p) => p == null ? void 0 : p.toLowerCase().replace(/\[\[|\]\]/g, "").trim().includes(needle)
          );
          if (!match) continue;
        }
        if (filter.scheduled) {
          const s = fm.scheduled;
          if (filter.scheduled === "today" && s !== today) continue;
          if (filter.scheduled === "week" && (!s || s < today || s > weekStr)) continue;
          if (filter.scheduled.startsWith("before:") && (!s || s >= filter.scheduled.replace("before:", "").trim())) continue;
          if (filter.scheduled.startsWith("after:") && (!s || s <= filter.scheduled.replace("after:", "").trim())) continue;
        }
        if (filter.due) {
          const d = fm.due;
          if (filter.due === "today" && d !== today) continue;
          if (filter.due === "week" && (!d || d < today || d > weekStr)) continue;
          if (filter.due.startsWith("before:") && (!d || d >= filter.due.replace("before:", "").trim())) continue;
          if (filter.due.startsWith("after:") && (!d || d <= filter.due.replace("after:", "").trim())) continue;
        }
        if (filter.tags && filter.tags.length > 0) {
          const fileTags = ((_a = cache.tags) == null ? void 0 : _a.map((t) => t.tag.replace("#", ""))) || [];
          if (!filter.tags.some((tag) => fileTags.includes(tag))) continue;
        }
        tasks.push({
          file,
          title: fm.title || file.basename,
          status: fm.status,
          scheduled: fm.scheduled,
          due: fm.due,
          projects: fm.projects ? Array.isArray(fm.projects) ? fm.projects : [fm.projects] : []
        });
      }
      tasks.sort((a, b) => {
        if (!a.scheduled) return 1;
        if (!b.scheduled) return -1;
        return a.scheduled.localeCompare(b.scheduled);
      });
      return tasks;
    });
  }
  renderAsInline(tasks, el, filter, sourcePath) {
    return __async(this, null, function* () {
      el.addClass("tn-view-container");
      if (tasks.length === 0) {
        el.createEl("div", { text: "No tasks found.", cls: "tn-view-empty" });
        return;
      }
      if (filter.project) {
        const projectName = filter.project.replace(/\[\[|\]\]/g, "").trim();
        const projectFile = this.app.metadataCache.getFirstLinkpathDest(projectName, sourcePath);
        const titleEl = el.createEl("div", { cls: "tn-view-project-title" });
        if (projectFile) {
          const link = titleEl.createEl("a", {
            text: projectName,
            cls: "internal-link tn-view-project-link"
          });
          link.addEventListener("click", () => {
            this.app.workspace.openLinkText(projectName, sourcePath, false);
          });
        } else {
          titleEl.createEl("span", { text: projectName });
        }
      }
      const component = new import_obsidian.Component();
      component.load();
      for (const task of tasks) {
        const taskEl = el.createEl("div", { cls: "tn-view-task-row" });
        const linkText = `[[${task.file.basename}]]`;
        yield import_obsidian.MarkdownRenderer.render(
          this.app,
          linkText,
          taskEl,
          sourcePath,
          component
        );
      }
      component.unload();
    });
  }
  onunload() {
  }
};
