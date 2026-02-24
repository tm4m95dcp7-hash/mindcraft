import { readFileSync, writeFileSync, mkdirSync } from 'fs';

export class TaskNotebook {
    constructor(agentName) {
        this.agentName = agentName;
        this.tasks = [];
        this.path = `./bots/${agentName}/tasks.json`;
        this.load();
    }

    load() {
        try {
            const data = readFileSync(this.path, 'utf8');
            this.tasks = JSON.parse(data);
        } catch {
            this.tasks = [];
        }
    }

    save() {
        try {
            mkdirSync(`./bots/${this.agentName}`, { recursive: true });
            writeFileSync(this.path, JSON.stringify(this.tasks, null, 2));
        } catch (e) {
            console.error('Failed to save task notebook:', e);
        }
    }

    addTask(description, priority = 2) {
        this.tasks.push({ id: Date.now(), description, priority, done: false });
        this.tasks.sort((a, b) => a.priority - b.priority);
        this.save();
        return `Task added: "${description}" (priority ${priority}).`;
    }

    getCurrentTask() {
        return this.tasks.find(t => !t.done) || null;
    }

    completeCurrentTask() {
        const task = this.getCurrentTask();
        if (!task) return { message: 'No active task in notebook.', next: null };
        task.done = true;
        this.save();
        const next = this.getCurrentTask();
        return { message: `Task done: "${task.description}".`, next };
    }

    listPending() {
        const pending = this.tasks.filter(t => !t.done);
        if (pending.length === 0) return 'No pending tasks in notebook.';
        return 'Pending tasks:\n' + pending.map((t, i) =>
            `${i + 1}. [Priority ${t.priority}] ${t.description}`
        ).join('\n');
    }

    getSummary() {
        const task = this.getCurrentTask();
        if (!task) return '';
        return `NOTEBOOK - Current task (priority ${task.priority}): "${task.description}"`;
    }
}
