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
          yield this.renderView(tasks, el, filter, ctx.sourcePath);
        } catch (e) {
          el.createEl("div", { text: "TN-View: Invalid filter syntax" });
        }
      }));
    });
  }
  getFilteredTasks(filter) {
    return __async(this, null, function* () {
      var _a, _b;
      const files = this.app.vault.getMarkdownFiles();
      const tasks = [];
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const weekLater = /* @__PURE__ */ new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      const weekStr = weekLater.toISOString().split("T")[0];
      const matchAny = ((_a = filter.match) == null ? void 0 : _a.toLowerCase()) === "any";
      for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!(cache == null ? void 0 : cache.frontmatter)) continue;
        const fm = cache.frontmatter;
        if (!fm.status) continue;
        const results = [];
        if (filter.status) {
          results.push(fm.status === filter.status);
        }
        if (filter.project) {
          const raw = fm.projects;
          if (!raw) {
            results.push(false);
          } else {
            const projects = Array.isArray(raw) ? raw : [raw];
            const needle = filter.project.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
            results.push(projects.some(
              (p) => p == null ? void 0 : p.toLowerCase().replace(/\[\[|\]\]/g, "").trim().includes(needle)
            ));
          }
        }
        if (filter.scheduled) {
          const s = fm.scheduled;
          let pass = false;
          if (filter.scheduled === "today") pass = s === today;
          else if (filter.scheduled === "week") pass = !!s && s >= today && s <= weekStr;
          else if (filter.scheduled.startsWith("before:")) pass = !!s && s < filter.scheduled.replace("before:", "").trim();
          else if (filter.scheduled.startsWith("after:")) pass = !!s && s > filter.scheduled.replace("after:", "").trim();
          results.push(pass);
        }
        if (filter.due) {
          const d = fm.due;
          let pass = false;
          if (filter.due === "today") pass = d === today;
          else if (filter.due === "week") pass = !!d && d >= today && d <= weekStr;
          else if (filter.due.startsWith("before:")) pass = !!d && d < filter.due.replace("before:", "").trim();
          else if (filter.due.startsWith("after:")) pass = !!d && d > filter.due.replace("after:", "").trim();
          results.push(pass);
        }
        if (filter.tags && filter.tags.length > 0) {
          const fm_tags = [];
          if (fm.tags) {
            const raw = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
            raw.forEach((t) => fm_tags.push(t.replace("#", "").trim()));
          }
          const body_tags = ((_b = cache.tags) == null ? void 0 : _b.map((t) => t.tag.replace("#", ""))) || [];
          const allTags = [.../* @__PURE__ */ new Set([...fm_tags, ...body_tags])];
          results.push(filter.tags.some((tag) => allTags.includes(tag.replace("#", "").trim())));
        }
        if (results.length === 0) continue;
        const passed = matchAny ? results.some((r) => r) : results.every((r) => r);
        if (!passed) continue;
        tasks.push({
          file,
          title: fm.title || file.basename,
          status: fm.status,
          scheduled: fm.scheduled,
          due: fm.due
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
  renderView(tasks, el, filter, sourcePath) {
    return __async(this, null, function* () {
      el.addClass("tn-view-container");
      const component = new import_obsidian.Component();
      component.load();
      const hasName = filter.name && filter.name.trim().length > 0;
      const isWikilink = hasName && filter.name.trim().startsWith("[[");
      if (hasName) {
        const titleRow = el.createEl("div", { cls: "tn-view-title-row" });
        if (isWikilink) {
          yield import_obsidian.MarkdownRenderer.render(
            this.app,
            filter.name.trim(),
            titleRow,
            sourcePath,
            component
          );
        } else {
          titleRow.createEl("span", {
            text: filter.name.trim(),
            cls: "tn-view-heading"
          });
        }
      }
      if (tasks.length === 0) {
        el.createEl("div", { text: "No tasks found.", cls: "tn-view-empty" });
      } else {
        for (const task of tasks) {
          const taskEl = el.createEl("div", { cls: "tn-view-task-row" });
          yield import_obsidian.MarkdownRenderer.render(
            this.app,
            `[[${task.file.basename}]]`,
            taskEl,
            sourcePath,
            component
          );
        }
      }
      component.unload();
    });
  }
  onunload() {
  }
};
