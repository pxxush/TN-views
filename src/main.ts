import { Plugin, parseYaml, TFile, MarkdownRenderer, Component } from "obsidian";

interface TNViewFilter {
  name?: string;
  project?: string;
  status?: string;
  scheduled?: string;
  due?: string;
  tags?: string[];
  match?: string;
}

interface TaskNote {
  file: TFile;
  status?: string;
  scheduled?: string;
  due?: string;
}

export default class TNViewPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("tn-view", async (source, el, ctx) => {
      try {
        const filter: TNViewFilter = parseYaml(source) || {};
        const tasks = await this.getFilteredTasks(filter);
        await this.renderView(tasks, el, filter, ctx.sourcePath);
      } catch (e) {
        el.createEl("div", { text: "TN-View: Invalid filter syntax" });
      }
    });
  }

  matchesDateFilter(filterVal: string, dateVal: string | undefined, today: string, weekStr: string): boolean {
    if (!filterVal) return true;
    const f = filterVal.trim();
    if (f === "today") return dateVal === today;
    if (f === "week") return !!dateVal && dateVal >= today && dateVal <= weekStr;
    if (f.startsWith("before:")) return !!dateVal && dateVal < f.replace("before:", "").trim();
    if (f.startsWith("after:")) return !!dateVal && dateVal > f.replace("after:", "").trim();
    if (f.startsWith("on:")) return dateVal === f.replace("on:", "").trim();
    if (f.startsWith("days:")) {
      const n = parseInt(f.replace("days:", "").trim());
      if (isNaN(n)) return false;
      const future = new Date();
      future.setDate(future.getDate() + n);
      const futureStr = future.toISOString().split("T")[0];
      return !!dateVal && dateVal >= today && dateVal <= futureStr;
    }
    return false;
  }

  matchesTagFilter(filterTags: string[], fileTags: string[]): boolean {
    return filterTags.some(filterTag => {
      const isBranch = filterTag.endsWith("/");
      if (isBranch) {
        const prefix = filterTag.toLowerCase();
        return fileTags.some(ft => ft.toLowerCase().startsWith(prefix));
      } else {
        return fileTags.some(ft => ft.toLowerCase() === filterTag.toLowerCase());
      }
    });
  }

  async getFilteredTasks(filter: TNViewFilter): Promise<TaskNote[]> {
    const files = this.app.vault.getMarkdownFiles();
    const tasks: TaskNote[] = [];
    const today = new Date().toISOString().split("T")[0];
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekStr = weekLater.toISOString().split("T")[0];
    const matchAny = filter.match?.toLowerCase() === "any";

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      const fm = cache.frontmatter;
      if (!fm.status) continue;

      const results: boolean[] = [];

      if (filter.status) results.push(fm.status === filter.status);

      if (filter.project) {
        const raw = fm.projects;
        if (!raw) {
          results.push(false);
        } else {
          const projects = Array.isArray(raw) ? raw : [raw];
          const needle = filter.project.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
          results.push(projects.some((p: string) =>
            p?.toLowerCase().replace(/\[\[|\]\]/g, "").trim().includes(needle)
          ));
        }
      }

      if (filter.scheduled) {
        results.push(this.matchesDateFilter(filter.scheduled, fm.scheduled, today, weekStr));
      }

      if (filter.due) {
        results.push(this.matchesDateFilter(filter.due, fm.due, today, weekStr));
      }

      if (filter.tags && filter.tags.length > 0) {
        const fm_tags: string[] = [];
        if (fm.tags) {
          const raw = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
          raw.forEach((t: string) => fm_tags.push(t.replace("#", "").trim()));
        }
        const body_tags = cache.tags?.map(t => t.tag.replace("#", "")) || [];
        const allTags = [...new Set([...fm_tags, ...body_tags])];
        const cleanFilterTags = filter.tags.map(t => t.replace("#", "").trim());
        results.push(this.matchesTagFilter(cleanFilterTags, allTags));
      }

      if (results.length === 0) continue;
      const passed = matchAny ? results.some(r => r) : results.every(r => r);
      if (!passed) continue;

      tasks.push({
        file,
        status: fm.status,
        scheduled: fm.scheduled,
        due: fm.due,
      });
    }

    tasks.sort((a, b) => {
      if (!a.scheduled) return 1;
      if (!b.scheduled) return -1;
      return a.scheduled.localeCompare(b.scheduled);
    });

    return tasks;
  }

  async renderTaskLink(file: TFile, container: HTMLElement, sourcePath: string, component: Component) {
    const temp = container.createEl("div");
    await MarkdownRenderer.render(
      this.app,
      `[[${file.basename}]]`,
      temp,
      sourcePath,
      component
    );
    const p = temp.querySelector("p");
    if (p) {
      while (p.firstChild) container.appendChild(p.firstChild);
      temp.remove();
    }
  }

  async renderView(tasks: TaskNote[], el: HTMLElement, filter: TNViewFilter, sourcePath: string) {
    el.addClass("tn-view-container");

    const component = new Component();
    component.load();

    const hasName = filter.name && filter.name.trim().length > 0;
    const isWikilink = hasName && filter.name!.trim().startsWith("[[");

    if (hasName) {
      const titleRow = el.createEl("div", { cls: "tn-view-title-row" });
      if (isWikilink) {
        const linkName = filter.name!.trim().replace(/\[\[|\]\]/g, "");
        const linkFile = this.app.metadataCache.getFirstLinkpathDest(linkName, sourcePath);
        if (linkFile) {
          await this.renderTaskLink(linkFile as TFile, titleRow, sourcePath, component);
        } else {
          titleRow.createEl("span", { text: linkName, cls: "tn-view-heading" });
        }
      } else {
        titleRow.createEl("span", {
          text: filter.name!.trim(),
          cls: "tn-view-heading"
        });
      }
    }

    if (tasks.length === 0) {
      el.createEl("div", { text: "No tasks found.", cls: "tn-view-empty" });
    } else {
      for (const task of tasks) {
        const taskEl = el.createEl("div", { cls: "tn-view-task-row" });
        await this.renderTaskLink(task.file, taskEl, sourcePath, component);
      }
    }

    component.unload();
  }

  onunload() {}
}
