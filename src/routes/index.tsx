import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { CityId } from "@/game/cities";
import { mountShores, type ShoreHandle } from "@/game/engine";

export const Route = createFileRoute("/")({ component: Home });

const SHORES: { id: CityId; name: string; place: string; line: string }[] = [
  {
    id: "melbourne",
    name: "Melbourne",
    place: "Flinders & the Yarra",
    line: "Cross the bridge. Climb to the dome.",
  },
  {
    id: "sydney",
    name: "Sydney",
    place: "Harbour & the shells",
    line: "Roofs, the arch, then the white shells.",
  },
  {
    id: "brisbane",
    name: "Queensland",
    place: "South Bank to Story Bridge",
    line: "Lawns, then the steel span.",
  },
];

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ShoreHandle | null>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState<CityId>("melbourne");
  const [playing, setPlaying] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [motes, setMotes] = useState({ n: 0, total: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mounted = mountShores(canvas, {
      city: "melbourne",
      onMotes: (n, total) => setMotes({ n, total }),
      onClaim: () => setClaimed(true),
      onCity: (id) => setCity(id),
      arrow: arrowRef.current,
    });
    handle.current = mounted;
    return () => {
      mounted.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    const el = stickRef.current;
    if (!el || !playing) return;

    const origin = { x: 0, y: 0, id: -1 };
    const cap = 58;

    const place = (clientX: number, clientY: number) => {
      let x = (clientX - origin.x) / cap;
      let y = (clientY - origin.y) / cap;
      const mag = Math.hypot(x, y);
      if (mag > 1) {
        x /= mag;
        y /= mag;
      }
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
      }
      const dead = 0.22;
      const curve = (v: number) => {
        const a = Math.abs(v);
        if (a < dead) return 0;
        return Math.sign(v) * ((a - dead) / (1 - dead));
      };
      handle.current?.setTouch({ steer: -curve(x), throttle: -curve(y) });
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      origin.x = e.clientX;
      origin.y = e.clientY;
      origin.id = e.pointerId;
      el.setPointerCapture(e.pointerId);
      place(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (origin.id !== e.pointerId) return;
      e.preventDefault();
      place(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (origin.id !== e.pointerId) return;
      origin.id = -1;
      if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
      handle.current?.setTouch({ steer: 0, throttle: 0 });
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [playing]);

  function pick(id: CityId) {
    setCity(id);
    setClaimed(false);
    handle.current?.setCity(id);
    handle.current?.setActive(false);
  }

  function start() {
    setPlaying(true);
    setClaimed(false);
    handle.current?.setCity(city);
    handle.current?.setActive(true);
  }

  function nextShore() {
    const order: CityId[] = ["melbourne", "sydney", "brisbane"];
    const id = order[(order.indexOf(city) + 1) % order.length]!;
    pick(id);
    setPlaying(true);
    handle.current?.setActive(true);
  }

  const shore = SHORES.find((s) => s.id === city)!;

  return (
    <main className="shore-shell">
      <div className="shore-photo" style={{ backgroundImage: `url(/shores/${city}.jpg)` }} />
      <div className="canvas-wrap" style={{ visibility: playing ? "visible" : "hidden" }}>
        <canvas ref={canvasRef} />
      </div>

      {playing && (
        <header className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex items-start justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <img src="/brand/futuret3ch.png" alt="Futuret3ch" className="h-11 w-11 object-contain" />
            <div>
              <p className="text-[11px] tracking-[0.22em] text-[#d4a04a] uppercase">Futuret3ch</p>
              <p className="text-sm text-[#efe8dc]">{shore.name}</p>
              <p className="text-xs text-[#efe8dc]/80">
                T3x {motes.n}/{motes.total}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              ref={arrowRef}
              className="grid h-9 w-9 place-items-center rounded-full border border-[#2ec8b0]/70 bg-black/35 text-[#2ec8b0]"
            >
              <span className="-mt-0.5 block text-sm">▲</span>
            </div>
            <img src="/brand/t3x-coin.png" alt="T3x" className="h-12 w-12 object-contain" />
          </div>
        </header>
      )}

      {!playing && (
        <section className="cover">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.28em] text-[#2ec8b0] uppercase">Supported by Futuret3ch</p>
              <h1 className="shore-title mt-2 text-5xl text-[#efe8dc] sm:text-7xl">Three Shores</h1>
              <p className="mt-3 max-w-md text-sm text-[#efe8dc]/85">
                Melbourne, Sydney, and Queensland. Pick a shore, then enter the shot.
              </p>
            </div>
            <img src="/brand/t3x-coin.png" alt="T3x" className="h-16 w-16 object-contain" />
          </div>
          <div className="cover-grid">
            {SHORES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className={`shore-card ${city === s.id ? "on" : ""}`}
              >
                <img src={`/shores/${s.id === "brisbane" ? "brisbane" : s.id}.jpg`} alt="" />
                <span className="py-2 pr-2">
                  <span className="block text-[10px] tracking-[0.16em] text-[#d4a04a] uppercase">{s.place}</span>
                  <span className="shore-title mt-1 block text-xl">{s.name}</span>
                  <span className="mt-1 block text-[11px] text-[#efe8dc]/75">{s.line}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={start}
              className="rounded-full bg-[#efe8dc] px-7 py-3 text-sm font-semibold tracking-wide text-[#071018]"
            >
              Start
            </button>
            <p className="text-xs text-[#efe8dc]/70">W run · A left · D right · Space jump</p>
          </div>
        </section>
      )}

      {playing && claimed && (
        <section className="absolute inset-0 z-20 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#efe8dc]/20 bg-[#071018]/80 text-center">
            <img src={`/shores/${city === "brisbane" ? "brisbane" : city}.jpg`} alt="" className="h-40 w-full object-cover" />
            <div className="p-6">
              <p className="text-[11px] tracking-[0.22em] text-[#d4a04a] uppercase">Shore claimed</p>
              <h2 className="shore-title mt-2 text-4xl">{shore.name}</h2>
              <p className="mt-2 text-sm text-[#efe8dc]/80">{motes.n} T3x motes gathered.</p>
              <button
                type="button"
                onClick={nextShore}
                className="mt-5 rounded-full bg-[#2ec8b0] px-5 py-3 text-sm font-semibold text-[#071018]"
              >
                Next shore
              </button>
            </div>
          </div>
        </section>
      )}

      {playing && !claimed && (
        <div className="touch-ui">
          <div ref={stickRef} className="stick">
            <div ref={knobRef} className="stick-knob" />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="act"
              onPointerDown={(e) => {
                e.preventDefault();
                handle.current?.setTouch({ sprint: true });
              }}
              onPointerUp={() => handle.current?.setTouch({ sprint: false })}
              onPointerCancel={() => handle.current?.setTouch({ sprint: false })}
            >
              Run
            </button>
            <button
              type="button"
              className="act jump"
              onPointerDown={(e) => {
                e.preventDefault();
                handle.current?.requestJump();
              }}
            >
              Jump
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
