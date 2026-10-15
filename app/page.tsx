"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Activity,
  Layers,
  ShieldCheck,
  FlaskConical,
  Search,
  Download,
  X,
  ChevronRight,
  Play,
  Terminal,
  PanelLeft,
  Box,
  Command,
  Check,
  AlertTriangle,
} from "lucide-react";
import type {
  Campaign,
  Candidate,
  Counterexample,
} from "../packages/orchestrator/index";
import type { AgentVersion, Category, Run } from "../packages/core/index";
type Screen =
  | "Overview"
  | "Agents"
  | "Scenario explorer"
  | "Execution monitor"
  | "Failure evidence"
  | "Coverage";
type Data = {
  campaigns: Campaign[];
  agents: {
    id: AgentVersion;
    name: string;
    variant: string;
    version: string;
    description: string;
  }[];
  tools: { name: string; authority: string }[];
  invariants: string[];
  categories: Category[];
  operators: { id: string; category: Category }[];
  busy: boolean;
  providers: { createos: string; planner: string };
};
const screens: { name: Screen; icon: typeof Layers }[] = [
  { name: "Overview", icon: Layers },
  { name: "Agents", icon: Box },
  { name: "Scenario explorer", icon: FlaskConical },
  { name: "Execution monitor", icon: Activity },
  { name: "Failure evidence", icon: ShieldCheck },
  { name: "Coverage", icon: Command },
];
const nice = (s: string) => s.replaceAll("-", " ").replaceAll("_", " ");
function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (value === "VIOLATION" || value === "confirmed"
          ? "danger"
          : value === "PASS"
            ? "good"
            : value === "running"
              ? "live"
              : "")
      }
    >
      {nice(value)}
    </span>
  );
}
function Json({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}
export default function Home() {
  const [data, setData] = useState<Data | null>(null),
    [screen, setScreen] = useState<Screen>("Overview"),
    [error, setError] = useState(""),
    [newOpen, setNewOpen] = useState(false),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [inspect, setInspect] = useState<{
      c: Campaign;
      candidate: Candidate;
    } | null>(null),
    [evidence, setEvidence] = useState<{
      c: Campaign;
      ce: Counterexample;
    } | null>(null),
    [mobile, setMobile] = useState(false),
    [submitting, setSubmitting] = useState(false);
  const [agent, setAgent] = useState<AgentVersion>("payment-vulnerable@1"),
    [budget, setBudget] = useState(30),
    [depth, setDepth] = useState(2),
    [seed, setSeed] = useState(7),
    [backend, setBackend] = useState("trusted-local"),
    [planner, setPlanner] = useState("deterministic"),
    [cats, setCats] = useState<Category[]>([
      "network",
      "data",
      "state",
      "authorization",
      "agent",
      "concurrency",
    ]);
  async function refresh() {
    try {
      const r = await fetch("/api/campaigns");
      if (!r.ok) throw new Error("Cannot load campaigns");
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  }
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 1500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNewOpen(false);
        setInspect(null);
        setEvidence(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!newOpen && !inspect && !evidence) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,summary,[tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = controls(),
        first = list[0],
        last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [newOpen, !!inspect, !!evidence]);
  const campaigns = data?.campaigns ?? [],
    current = campaigns.find((c) => c.id === selected) ?? campaigns[0],
    runs = campaigns.flatMap((c) => c.runs),
    failures = campaigns.flatMap((c) =>
      c.counterexamples
        .filter((ce) => ce.status === "confirmed")
        .map((ce) => ({ c, ce })),
    ),
    unknown = runs.filter((r) => r.verdict === "INCONCLUSIVE").length;
  const visible =
    current?.candidates.filter(
      (x) =>
        (category === "all" ||
          x.world.faults.some(
            (f) =>
              data?.operators.find((o) => o.id === f.operator)?.category ===
              category,
          )) &&
        (
          x.world.id +
          " " +
          x.world.faults.map((f) => f.operator).join(" ") +
          " " +
          x.reason
        )
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];
  async function start() {
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentVersion: agent,
          categories: cats,
          budget,
          depth,
          seed,
          backend,
          planner,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setSelected(body.id);
      setNewOpen(false);
      setScreen("Execution monitor");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Campaign creation failed");
    } finally {
      setSubmitting(false);
    }
  }
  async function replay(c: Campaign, scenarioId: string, hardened: boolean) {
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/campaigns/" + c.id + "/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, hardened }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setSelected(body.id);
      setInspect(null);
      setEvidence(null);
      setScreen("Execution monitor");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setSubmitting(false);
    }
  }
  const download = (c: Campaign, kind = "campaign", ce?: Counterexample) =>
    "/api/campaigns/" +
    c.id +
    "/export?kind=" +
    kind +
    (ce ? "&counterexample=" + ce.id : "");
  function CampaignPicker() {
    return (
      <select
        aria-label="Campaign"
        value={current?.id ?? ""}
        onChange={(e) => setSelected(e.target.value)}
      >
        {campaigns.length === 0 && <option value="">No campaigns yet</option>}
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.config.agentVersion} ·{" "}
            {new Date(c.createdAt).toLocaleTimeString()} · {c.id.slice(0, 6)}
          </option>
        ))}
      </select>
    );
  }
  function Empty({
    title = "No experiments yet",
    text = "Start a campaign to generate scenarios and observe the agent in a controlled environment.",
  }: {
    title?: string;
    text?: string;
  }) {
    return (
      <div className="empty">
        <FlaskConical size={30} />
        <h3>{title}</h3>
        <p>{text}</p>
        <button onClick={() => setNewOpen(true)}>
          <Plus size={15} />
          New campaign
        </button>
      </div>
    );
  }
  function Trace({ run }: { run: Run }) {
    return (
      <>
        <div className="row">
          <Badge value={run.verdict} />
          <span className="mono">
            {run.backend} · {run.durationMs} ms · {run.purpose}
          </span>
        </div>
        {run.error && <p className="notice">{run.error}</p>}
        <div className="trace">
          {run.observation?.events.map((e) => (
            <details key={e.seq}>
              <summary>
                <span className="mono">{String(e.seq).padStart(2, "0")}</span>
                <span>{e.kind}</span>
                <strong>{e.tool}</strong>
                <small>
                  t+{e.time - (run.observation?.initial ? 1000 : 0)}
                </small>
              </summary>
              <Json value={e.data} />
            </details>
          ))}
        </div>
      </>
    );
  }
  return (
    <div className="shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setScreen("Overview");
          }}
        >
          <span className="brandmark">G</span>GHOSTRUN
          <span className="alpha">LAB</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            Synthetic workspace<small>Local development</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {screens.map(({ name, icon: Icon }) => (
            <button
              className={screen === name ? "active" : ""}
              key={name}
              onClick={() => {
                setScreen(name);
                setMobile(false);
              }}
            >
              <Icon size={17} />
              {name}
              {name === "Failure evidence" && failures.length > 0 && (
                <span className="count">{failures.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            Deterministic by default<small>Evidence over predictions.</small>
          </div>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <button
            className="mobile-toggle subtle"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation"
          >
            <PanelLeft size={18} />
          </button>
          <span>Workspace</span>
          <ChevronRight size={12} />
          <strong>{screen}</strong>
          <span className="topbar-right">
            <span className="status-dot" />
            {data?.busy ? "Campaign running" : "Engine ready"}
            <span className="avatar">GR</span>
          </span>
        </div>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">AGENT RELIABILITY LABORATORY</div>
              <h1>{screen}</h1>
              <p>
                {screen === "Overview"
                  ? "Let’s see what survives."
                  : screen === "Failure evidence"
                    ? "Every finding, backed by an executable counterexample."
                    : screen === "Coverage"
                      ? "What we exercised. What remains unexplored."
                      : "Controlled experiments. Observable behavior. Reproducible results."}
              </p>
            </div>
            <button onClick={() => setNewOpen(true)} disabled={data?.busy}>
              <Plus size={16} />
              New campaign
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              <AlertTriangle size={16} />
              {error}
              <button
                className="subtle"
                onClick={() => {
                  setError("");
                  void refresh();
                }}
              >
                Retry / dismiss
              </button>
            </div>
          )}
          {!data ? (
            <div className="empty" role="status">
              Loading laboratory…
            </div>
          ) : (
            <>
              {screen === "Overview" && (
                <>
                  <div className="metrics">
                    {[
                      {
                        label: "Experiments executed",
                        value: runs.length,
                        foot: "Across " + campaigns.length + " campaigns",
                      },
                      {
                        label: "Confirmed findings",
                        value: failures.length,
                        foot: "Reproduced 3 of 3 times",
                        red: true,
                      },
                      {
                        label: "Passing experiments",
                        value: runs.filter((r) => r.verdict === "PASS").length,
                        foot: "Completed, valid executions",
                      },
                      {
                        label: "Inconclusive",
                        value: unknown,
                        foot: "Insufficient or unreached evidence",
                      },
                    ].map((m) => (
                      <div className="metric" key={m.label}>
                        <span>{m.label}</span>
                        <strong className={m.red && m.value ? "red" : ""}>
                          {m.value.toString().padStart(2, "0")}
                        </strong>
                        <small>{m.foot}</small>
                      </div>
                    ))}
                  </div>
                  <section className="intro">
                    <div className="intro-icon">
                      <FlaskConical size={25} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        A CONTROLLED WORLD. A REAL FAILURE.
                      </span>
                      <h2>Find the conditions that break your agent.</h2>
                      <p>
                        Explore faulty dependencies, replay actual behavior, and
                        preserve the smallest counterexample you can reproduce.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        setAgent("payment-vulnerable@1");
                        setCats(["network"]);
                        setBudget(24);
                        setNewOpen(true);
                      }}
                    >
                      Run payment experiment <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Recent campaigns{" "}
                          <span className="number">{campaigns.length}</span>
                        </h2>
                        <p>Real executions from your laboratory</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setScreen("Execution monitor")}
                      >
                        View monitor <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {!campaigns.length ? (
                      <Empty />
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Campaign / target</th>
                              <th>Backend</th>
                              <th>Executions</th>
                              <th>Findings</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {campaigns.slice(0, 6).map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <button
                                    className="cell-button"
                                    onClick={() => {
                                      setSelected(c.id);
                                      setScreen("Execution monitor");
                                    }}
                                  >
                                    <strong>Payment Operations</strong>
                                    <small>
                                      {c.config.agentVersion} ·{" "}
                                      {c.id.slice(0, 8)}
                                    </small>
                                  </button>
                                </td>
                                <td className="mono">{c.config.backend}</td>
                                <td>
                                  {c.runs.length} / {c.config.budget}
                                </td>
                                <td>
                                  {
                                    c.counterexamples.filter(
                                      (x) => x.status === "confirmed",
                                    ).length
                                  }
                                </td>
                                <td>
                                  <Badge value={c.status} />
                                </td>
                                <td>
                                  <ArrowUpRight size={14} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                  <div className="two-col">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Latest findings</h2>
                        <ShieldCheck size={18} />
                      </div>
                      {!failures.length ? (
                        <div className="quiet-empty">
                          No confirmed violations yet.
                          <small>
                            Findings appear only after successful reproduction.
                          </small>
                        </div>
                      ) : (
                        failures.slice(0, 3).map(({ c, ce }) => (
                          <button
                            className="finding-row"
                            key={ce.id}
                            onClick={() => setEvidence({ c, ce })}
                          >
                            <span className="finding-marker" />
                            <div>
                              <strong>{nice(ce.violationIds[0])}</strong>
                              <small>
                                {ce.violationIds.length} violated properties ·{" "}
                                {c.config.backend}
                              </small>
                            </div>
                            <ArrowUpRight size={15} />
                          </button>
                        ))
                      )}
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Execution environment</h2>
                        <Terminal size={18} />
                      </div>
                      <div className="environment">
                        <div>
                          <span>Trusted local fixtures</span>
                          <Badge value="available" />
                        </div>
                        <div>
                          <span>CreateOS sandbox</span>
                          <span>{data.providers.createos}</span>
                        </div>
                        <div>
                          <span>LLM planner</span>
                          <span>{data.providers.planner}</span>
                        </div>
                        <p>
                          Local mode runs reviewed synthetic fixtures. It is not
                          an isolation boundary.
                        </p>
                      </div>
                    </section>
                  </div>
                </>
              )}
              {screen === "Agents" && (
                <>
                  <div className="two-col">
                    {data.agents.map((a) => (
                      <section className="panel agent-card" key={a.id}>
                        <div className="row">
                          <span className="agent-icon">
                            <Box />
                          </span>
                          <Badge value={a.variant} />
                        </div>
                        <h2>{a.name}</h2>
                        <p>{a.description}</p>
                        <dl>
                          <dt>Version</dt>
                          <dd>{a.id}</dd>
                          <dt>Adapter</dt>
                          <dd>Bundled TypeScript fixture</dd>
                          <dt>Campaigns</dt>
                          <dd>
                            {
                              campaigns.filter(
                                (c) => c.config.agentVersion === a.id,
                              ).length
                            }
                          </dd>
                        </dl>
                        <button
                          className="secondary"
                          onClick={() => {
                            setAgent(a.id);
                            setNewOpen(true);
                          }}
                        >
                          Test this agent <ArrowRight size={15} />
                        </button>
                      </section>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Declared tool contracts</h2>
                    </div>
                    {data.tools.map((t) => (
                      <div className="tool-row" key={t.name}>
                        <code>{t.name}</code>
                        <span>{t.authority}</span>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Operational invariants</h2>
                    </div>
                    {data.invariants.map((i, n) => (
                      <div className="tool-row" key={i}>
                        <span className="mono">0{n + 1}</span>
                        <strong>{nice(i)}</strong>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {screen === "Scenario explorer" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>Worlds under test</h2>
                    <CampaignPicker />
                  </div>
                  <div className="filters">
                    <label className="search">
                      <Search size={16} />
                      <input
                        placeholder="Search scenarios, operators, reasons…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Category filter"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {data.categories.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  {!current ? (
                    <Empty />
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Scenario</th>
                            <th>Operators</th>
                            <th>Validation / selection</th>
                            <th>Result</th>
                            <th>Origin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((x, i) => {
                            const r = current.runs.find(
                              (r) => r.id === x.runId,
                            );
                            return (
                              <tr key={x.world.id + "-" + i}>
                                <td>
                                  <button
                                    className="cell-button"
                                    onClick={() =>
                                      setInspect({ c: current, candidate: x })
                                    }
                                  >
                                    <strong className="mono">
                                      {x.world.id.slice(0, 10)}
                                    </strong>
                                    <small>
                                      {x.world.parentId
                                        ? "↳ " + x.world.parentId.slice(0, 8)
                                        : "Root world"}
                                    </small>
                                  </button>
                                </td>
                                <td>
                                  {x.world.faults.map((f) => (
                                    <span className="operator" key={f.operator}>
                                      {f.operator}
                                    </span>
                                  ))}
                                  {!x.world.faults.length && "Baseline"}
                                </td>
                                <td>
                                  <Badge value={x.status} />
                                  <small className="truncate" title={x.reason}>
                                    {x.reason}
                                  </small>
                                </td>
                                <td>
                                  {r ? (
                                    <Badge value={r.verdict} />
                                  ) : (
                                    <span className="muted">Not executed</span>
                                  )}
                                </td>
                                <td>{x.world.metadata.source}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!visible.length && (
                        <div className="quiet-empty">
                          No scenarios match this search.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
              {screen === "Execution monitor" && (
                <>
                  <div className="row toolbar">
                    <CampaignPicker />
                    {current && (
                      <a className="button secondary" href={download(current)}>
                        <Download size={15} />
                        Export campaign
                      </a>
                    )}
                  </div>
                  {!current ? (
                    <Empty />
                  ) : (
                    <>
                      <div className="metrics">
                        {["queued", "running", "completed", "pruned"].map(
                          (status) => (
                            <div className="metric" key={status}>
                              <span>{nice(status)}</span>
                              <strong>
                                {
                                  current.candidates.filter(
                                    (x) => x.status === status,
                                  ).length
                                }
                              </strong>
                              <small>Candidate worlds</small>
                            </div>
                          ),
                        )}
                      </div>
                      <div className="row budget-row">
                        <Badge value={current.status} />
                        <span>
                          {current.runs.length} / {current.config.budget}{" "}
                          executions · {current.config.backend} ·{" "}
                          {current.planner.mode} planning
                        </span>
                      </div>
                      {current.error && (
                        <p className="error">{current.error}</p>
                      )}
                      <div className="two-col monitor">
                        <section className="panel">
                          <div className="section-heading">
                            <h2>Experiment results</h2>
                          </div>
                          {current.runs.map((r) => (
                            <button
                              className="run-row"
                              key={r.id}
                              onClick={() => {
                                const candidate = current.candidates.find(
                                  (x) => x.world.id === r.scenarioId,
                                );
                                if (candidate)
                                  setInspect({
                                    c: current,
                                    candidate: { ...candidate, runId: r.id },
                                  });
                              }}
                            >
                              <Badge value={r.verdict} />
                              <span>
                                <strong className="mono">
                                  {r.scenarioId.slice(0, 10)}
                                </strong>
                                <small>
                                  {r.purpose} · {r.durationMs} ms
                                </small>
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          ))}
                        </section>
                        <section className="panel">
                          <div className="section-heading">
                            <h2>Campaign timeline</h2>
                          </div>
                          <ol className="timeline">
                            {current.log.map((l, i) => (
                              <li key={i}>
                                <span className="timeline-dot" />
                                <small>
                                  {new Date(l.at).toLocaleTimeString()}
                                </small>
                                <p>{l.message}</p>
                              </li>
                            ))}
                          </ol>
                        </section>
                      </div>
                    </>
                  )}
                </>
              )}
              {screen === "Failure evidence" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>Counterexample registry</h2>
                    <span className="muted">
                      Confirmed and unconfirmed observations
                    </span>
                  </div>
                  {!campaigns.some((c) => c.counterexamples.length) ? (
                    <Empty
                      title="No counterexamples recorded"
                      text="Run the vulnerable fixture to look for reproducible violations."
                    />
                  ) : (
                    campaigns.flatMap((c) =>
                      c.counterexamples.map((ce) => (
                        <button
                          className="evidence-row"
                          key={ce.id}
                          onClick={() => setEvidence({ c, ce })}
                        >
                          <div>
                            <div className="row">
                              <Badge value={ce.status} />
                              <span className="mono">{ce.id.slice(0, 8)}</span>
                            </div>
                            <h3>{ce.violationIds.map(nice).join(" · ")}</h3>
                            <p>
                              {ce.reproduced}/{ce.attempted} matching executions
                              · {c.config.backend} · {c.config.agentVersion}
                            </p>
                          </div>
                          <ArrowUpRight size={20} />
                        </button>
                      )),
                    )
                  )}
                </section>
              )}
              {screen === "Coverage" && (
                <>
                  <div className="row toolbar">
                    <CampaignPicker />
                    <span className="muted">
                      Measured observations, not a safety score
                    </span>
                  </div>
                  {!current ? (
                    <Empty />
                  ) : (
                    <>
                      <section className="panel">
                        <div className="section-heading">
                          <h2>Fault category exposure</h2>
                          <span>
                            {current.config.budget - current.runs.length}{" "}
                            executions remaining
                          </span>
                        </div>
                        {data.categories.map((cat) => {
                          const n = current.coverage.categories[cat] ?? 0;
                          return (
                            <div className="coverage-row" key={cat}>
                              <strong>{nice(cat)}</strong>
                              <div className="bar">
                                <span
                                  style={{
                                    width:
                                      (n
                                        ? Math.max(
                                            4,
                                            (n /
                                              Math.max(
                                                1,
                                                ...Object.values(
                                                  current.coverage.categories,
                                                ),
                                              )) *
                                              100,
                                          )
                                        : 0) + "%",
                                  }}
                                />
                              </div>
                              <span>{n} injections observed</span>
                              <Badge value={n ? "exercised" : "untested"} />
                            </div>
                          );
                        })}
                        <p className="panel-note">
                          Counts include replay and minimization. A category
                          exposure does not imply exhaustive coverage.
                        </p>
                      </section>
                      <div className="two-col">
                        <section className="panel">
                          <div className="section-heading">
                            <h2>Observed state transitions</h2>
                          </div>
                          {current.coverage.transitions.map((t) => (
                            <div className="tool-row" key={t}>
                              <Check size={15} />
                              <span>{t}</span>
                            </div>
                          ))}
                        </section>
                        <section className="panel">
                          <div className="section-heading">
                            <h2>Executed fault combinations</h2>
                          </div>
                          {current.coverage.combinations.map((t) => (
                            <div className="tool-row" key={t}>
                              <span>{t}</span>
                            </div>
                          ))}
                        </section>
                      </div>
                      <p className="notice">
                        {
                          current.candidates.filter(
                            (c) => c.status === "pruned",
                          ).length
                        }{" "}
                        candidates pruned.{" "}
                        {
                          current.candidates.filter(
                            (c) => c.status === "queued",
                          ).length
                        }{" "}
                        worlds remain unexecuted. Unsupported fault classes and
                        real banking behavior remain outside this campaign.
                      </p>
                    </>
                  )}
                </>
              )}
            </>
          )}
          <footer>
            <span>GHOSTRUN / ENGINE 0.1</span>
            <span>
              Simulated conditions. Verifiable evidence. No universal safety
              claims.
            </span>
          </footer>
        </div>
      </main>
      {newOpen && (
        <div className="overlay" onClick={() => setNewOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-title"
            className="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <div className="eyebrow">NEW EXPERIMENT</div>
                <h2 id="campaign-title">Create a campaign</h2>
              </div>
              <button
                aria-label="Close"
                className="subtle"
                onClick={() => setNewOpen(false)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void start();
              }}
            >
              <label>
                Target agent
                <select
                  value={agent}
                  onChange={(e) => setAgent(e.target.value as AgentVersion)}
                >
                  <option value="payment-vulnerable@1">
                    Payment Operations · vulnerable fixture
                  </option>
                  <option value="payment-hardened@1">
                    Payment Operations · hardened reference
                  </option>
                </select>
              </label>
              <fieldset>
                <legend>Failure categories</legend>
                <div className="checks">
                  {(
                    [
                      "network",
                      "data",
                      "state",
                      "authorization",
                      "agent",
                      "concurrency",
                    ] as Category[]
                  ).map((cat) => (
                    <label key={cat}>
                      <input
                        type="checkbox"
                        checked={cats.includes(cat)}
                        onChange={() =>
                          setCats(
                            cats.includes(cat)
                              ? cats.filter((c) => c !== cat)
                              : [...cats, cat],
                          )
                        }
                      />
                      {nice(cat)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="form-grid">
                <label>
                  Execution budget
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                  />
                </label>
                <label>
                  Mutation depth
                  <input
                    type="number"
                    min="0"
                    max="3"
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                  />
                </label>
                <label>
                  Seed
                  <input
                    type="number"
                    min="0"
                    max="2147483647"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                  />
                </label>
              </div>
              <label>
                Execution backend
                <select
                  value={backend}
                  onChange={(e) => setBackend(e.target.value)}
                >
                  <option value="trusted-local">
                    Trusted local · bundled fixtures only
                  </option>
                  <option value="createos">
                    CreateOS sandbox · {data?.providers.createos}
                  </option>
                </select>
              </label>
              <label>
                Scenario planning
                <select
                  value={planner}
                  onChange={(e) => setPlanner(e.target.value)}
                >
                  <option value="deterministic">
                    Deterministic operator exploration
                  </option>
                  <option value="llm">
                    LLM-assisted · {data?.providers.planner}
                  </option>
                </select>
              </label>
              <p className="notice">
                Budget includes discovery, reproduction, minimization, and
                reference-agent regression. All payments are synthetic.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || data?.busy || !cats.length}
              >
                <Play size={15} />
                {submitting ? "Starting…" : "Start campaign"}
              </button>
            </form>
          </section>
        </div>
      )}
      {inspect && (
        <div
          className="overlay inspector-overlay"
          onClick={() => setInspect(null)}
        >
          <section
            className="inspector"
            role="dialog"
            aria-modal="true"
            aria-label="Scenario inspector"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <div className="eyebrow">SCENARIO INSPECTOR</div>
                <h2 className="mono">
                  {inspect.candidate.world.id.slice(0, 12)}
                </h2>
              </div>
              <button
                className="subtle"
                aria-label="Close inspector"
                onClick={() => setInspect(null)}
              >
                <X />
              </button>
            </div>
            <p>{inspect.candidate.reason}</p>
            <div className="row">
              <button
                className="secondary"
                disabled={data?.busy || submitting}
                onClick={() =>
                  void replay(inspect.c, inspect.candidate.world.id, false)
                }
              >
                <Play size={14} />
                Replay
              </button>
              <button
                className="secondary"
                disabled={data?.busy || submitting}
                onClick={() =>
                  void replay(inspect.c, inspect.candidate.world.id, true)
                }
              >
                Test hardened reference
              </button>
            </div>
            <h3>Structured world</h3>
            <Json value={inspect.candidate.world} />
            <h3>Execution trace</h3>
            {(() => {
              const r = inspect.c.runs.find(
                (r) => r.id === inspect.candidate.runId,
              );
              return r ? (
                <>
                  <Trace run={r} />
                  <h3>Invariant results</h3>
                  {r.invariants.map((i) => (
                    <div className="invariant-row" key={i.id}>
                      <Badge value={i.verdict} />
                      <strong>{nice(i.id)}</strong>
                      <p>{i.explanation}</p>
                    </div>
                  ))}
                </>
              ) : (
                <p>Not executed.</p>
              );
            })()}
          </section>
        </div>
      )}
      {evidence && (
        <div
          className="overlay inspector-overlay"
          onClick={() => setEvidence(null)}
        >
          <section
            className="inspector evidence-inspector"
            role="dialog"
            aria-modal="true"
            aria-label="Failure evidence inspector"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <div className="eyebrow">EXECUTABLE COUNTEREXAMPLE</div>
                <h2>Failure evidence</h2>
              </div>
              <button
                className="subtle"
                aria-label="Close evidence"
                onClick={() => setEvidence(null)}
              >
                <X />
              </button>
            </div>
            <Badge value={evidence.ce.status} />
            <h2>{evidence.ce.violationIds.map(nice).join(" · ")}</h2>
            <p>
              {evidence.ce.reproduced} / {evidence.ce.attempted} original-world
              executions reproduced the same violations.
            </p>
            <div className="row">
              <a
                className="button secondary"
                href={download(evidence.c, "evidence", evidence.ce)}
              >
                <Download size={15} />
                Evidence JSON
              </a>
              <a
                className="button secondary"
                href={download(evidence.c, "regression", evidence.ce)}
              >
                <Download size={15} />
                Regression test
              </a>
            </div>
            <h3>Triggering conditions</h3>
            <Json
              value={
                evidence.c.candidates.find(
                  (x) => x.world.id === evidence.ce.minimizedScenarioId,
                )?.world.faults
              }
            />
            <p>{evidence.ce.minimality}</p>
            <details className="minimized-world">
              <summary>
                Minimized executable world ·{" "}
                {evidence.ce.minimizedScenarioId.slice(0, 12)}
              </summary>
              <Json
                value={
                  evidence.c.candidates.find(
                    (x) => x.world.id === evidence.ce.minimizedScenarioId,
                  )?.world
                }
              />
            </details>
            {(() => {
              const run = evidence.c.runs.find(
                (r) => r.id === evidence.ce.runIds[0],
              );
              const regression = evidence.c.runs.find(
                (r) => r.id === evidence.ce.regressionRunId,
              );
              return (
                <>
                  {run && (
                    <>
                      <h3>Original execution: before → after</h3>
                      <div className="two-col">
                        <div>
                          <small>Authorized input</small>
                          <Json value={run.observation?.initial} />
                        </div>
                        <div>
                          <small>Actual bank ledger</small>
                          <Json value={run.observation?.ledger} />
                        </div>
                      </div>
                      <h3>Exact tool timeline</h3>
                      <Trace run={run} />
                    </>
                  )}
                  <h3>Hardened reference regression</h3>
                  {regression ? (
                    <div className="notice">
                      <Badge value={regression.verdict} /> {regression.backend}{" "}
                      · {regression.observation?.ledger.length ?? 0} bank
                      operations
                    </div>
                  ) : (
                    <p>Not executed within this campaign budget.</p>
                  )}
                </>
              );
            })()}
            <button
              disabled={data?.busy || submitting}
              onClick={() =>
                void replay(evidence.c, evidence.ce.minimizedScenarioId, true)
              }
            >
              Run hardened reference <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
