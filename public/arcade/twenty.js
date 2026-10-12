// 20 Questions screen. Lists and buttons, so it's plain HTML rather than a canvas.
import G from "/shared/twenty.js";
import { CATEGORIES, QUESTIONS, THINGS, thingById, questionById } from "/shared/twenty-kb.js";
import { sleep } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const HTML = true;
export const scoreOf = (v, seat) => ({
  mine: v.used[seat],
  theirs: v.used[1 - seat],
  unit: "questions used, fewest wins",
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TABS = ["Kind", ...CATEGORIES.map((c) => c.name), "Guess"];

export default function twenty({ host, seat, canMove, submit, hint, toast }) {
  const root = document.createElement("div");
  root.className = "tq";
  host.prepend(root);
  let view = null;
  let tab = "Kind";
  let guessCat = CATEGORIES[0].id;

  const logHtml = (round) => {
    const entries = view.log[round];
    if (!entries.length) return `<p class="muted">No questions yet.</p>`;
    return `<ul class="tq-log">${entries.slice().reverse().map((e) => e.kind === "q"
      ? `<li><span>${esc(questionById.get(e.q).text)}</span><b>${e.answer ? "Yes" : "No"}</b></li>`
      : `<li><span>Is it ${esc(thingById.get(e.id).name)}?</span><b>${e.right ? "Got it!" : "No"}</b></li>`).join("")}</ul>`;
  };

  function draw() {
    if (!view) return;
    const myTurn = canMove();
    if (view.phase === "pick") {
      root.innerHTML = view.mine
        ? `<div class="tq-card"><h3>Your secret: ${esc(thingById.get(view.mine).name)}</h3><p>Waiting for the other side to pick.</p></div>`
        : `<div class="tq-card"><h3>Pick your secret</h3><p>Choose something for the other side to guess. Keep it to yourself.</p></div>
           ${thingsPicker("pick")}`;
      return;
    }
    if (view.phase === "done") {
      root.innerHTML = `<div class="tq-card"><h3>Your thing was ${esc(thingById.get(view.mine).name)}</h3>
          <p>Theirs was <b>${esc(thingById.get(view.theirs).name)}</b>.</p></div>
        <div class="tq-card"><h3>Round 1</h3>${logHtml(0)}</div>
        <div class="tq-card"><h3>Round 2</h3>${logHtml(1)}</div>`;
      return;
    }
    const iAsk = view.asker === seat;
    if (iAsk) {
      const asked = new Map(view.log[view.round].filter((e) => e.kind === "q").map((e) => [e.q, e.answer]));
      const guessed = new Set(view.log[view.round].filter((e) => e.kind === "guess").map((e) => e.id));
      root.innerHTML = `
        <div class="tq-card"><h3>Find their thing</h3>
          <p>${20 - view.used[seat]} questions left. A guess counts as a question.</p>${logHtml(view.round)}</div>
        <div class="tq-tabs" role="tablist">${TABS.map((t) => `<button data-tqtab="${esc(t)}" aria-pressed="${t === tab}">${esc(t)}</button>`).join("")}</div>
        ${tab === "Guess"
          ? thingsPicker("guess", guessed)
          : `<div class="tq-list">${QUESTIONS.filter((q) => q.group === tab).map((q) =>
              `<button data-ask="${q.id}" ${asked.has(q.id) || !myTurn ? "disabled" : ""}>${esc(q.text)}${asked.has(q.id) ? `<b>${asked.get(q.id) ? "Yes" : "No"}</b>` : ""}</button>`).join("")}</div>`}
        <button class="btn light" data-giveup>Give up this round</button>`;
    } else {
      const q = view.pending ? questionById.get(view.pending.q) : null;
      root.innerHTML = `
        <div class="tq-card"><h3>Your secret: ${esc(thingById.get(view.mine).name)}</h3>
          ${q ? `<p class="tq-ask">${esc(q.text)}</p>
            <div class="tq-yn"><button class="btn" data-answer="y" ${myTurn ? "" : "disabled"}>Yes</button>
            <button class="btn" data-answer="n" ${myTurn ? "" : "disabled"}>No</button></div>`
            : `<p>They're thinking…</p>`}
        </div>
        <div class="tq-card"><h3>Their questions so far</h3>${logHtml(view.round)}</div>`;
    }
  }

  function thingsPicker(action, skip = new Set()) {
    const cat = action === "guess" ? guessCat : guessCat;
    return `<div class="tq-tabs">${CATEGORIES.map((c) => `<button data-cat="${c.id}" aria-pressed="${c.id === cat}">${esc(c.name)}</button>`).join("")}</div>
      <div class="tq-things">${THINGS.filter((t) => t.cat === cat).map((t) =>
        `<button data-${action}="${t.id}" ${skip.has(t.id) || !canMove() ? "disabled" : ""}>${esc(t.name)}</button>`).join("")}</div>`;
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.tqtab) { tab = b.dataset.tqtab; draw(); return; }
    if (b.dataset.cat) { guessCat = b.dataset.cat; draw(); return; }
    if (!canMove()) return;
    if (b.dataset.pick) return submit({ pick: b.dataset.pick });
    if (b.dataset.ask) return submit({ ask: b.dataset.ask });
    if (b.dataset.guess) return submit({ guess: b.dataset.guess });
    if (b.dataset.answer) return submit({ answer: b.dataset.answer });
    if (b.dataset.giveup !== undefined) return submit({ giveUp: true });
  });

  hint(G.how);
  return {
    render(m) {
      view = m.view;
      draw();
      if (view.phase === "pick") hint("Pick a secret thing for the other side to guess.");
      else if (view.phase === "play") hint(view.asker === seat ? "Ask yes-or-no questions, or make a guess." : "Answer honestly: Doingz checks.");
    },
    async play(events, m, before) {
      for (const e of events) {
        if (!e.snap) continue;
        view = e.snap;
        draw();
        if (e.type === "answer" && e.corrected && e.seat === seat) toast(`Not quite: for ${thingById.get(view.mine).name} that's a ${e.answer ? "yes" : "no"}.`);
        if (e.type === "guess" && e.seat !== seat) toast(e.right ? "They guessed it!" : `They guessed ${thingById.get(e.id).name}. Wrong!`);
        if (e.type === "guess" && e.seat === seat) toast(e.right ? "You got it!" : "Not that one");
        if (e.type === "gave_up" || (e.type === "guess" && !e.right && e.was)) toast(`It was ${thingById.get(e.was).name}.`);
        await sleep(e.seat === seat ? 80 : 650);
      }
    },
    destroy() { root.remove(); },
  };
}
