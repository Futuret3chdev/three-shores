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
    line: "Cross Princes Bridge and climb the station dome.",
  },
  {
    id: "sydney",
    name: "Sydney",
    place: "The Rocks to the shells",
    line: "Roof to roof, then the harbour arch to the white shells.",
  },
  {
    id: "brisbane",
    name: "Queensland",
    place: "South Bank to Story Bridge",
    line: "Leave the lawns, take the steel, claim the span.",
  },
];

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ShoreHandle | null>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState<CityId>("melbourne");
  const [playing, setPlaying] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [motes, setMotes] = useState({ n: 0, total: 0 });
  const [stick, setStick] = useState({ x: 0, y: 0, on: false });
  const stickOrigin = useRef({ x: 0, y: 0, id: -1 });

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

  function pick(id: CityId) {
    setCity(id);
    setClaimed(false);
    handle.current?.setCity(id);
  }

  function start() {
    setPlaying(true);
    setClaimed(false);
    handle.current?.setActive(true);
  }

  function nextShore() {
    const order: CityId[] = ["melbourne", "sydney", "brisbane"];
    const id = order[(order.indexOf(city) + 1) % order.length]!;
    pick(id);
    setClaimed(false);
    handle.current?.setActive(true);
  }

  function onStickDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    stickOrigin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setStick({ x: 0, y: 0, on: true });
  }
  function onStickMove(e: React.PointerEvent) {
    if (stickOrigin.current.id !== e.pointerId) return;
    const dx = e.clientX - stickOrigin.current.x;
    const dy = e.clientY - stickOrigin.current.y;
    const mag = Math.hypot(dx, dy) || 1;
    const cap = 48;
    const k = Math.min(cap, mag) / mag;
    const x = (dx * k) / cap;
    const y = (dy * k) / cap;
    setStick({ x, y, on: true });
    handle.current?.setTouch({ steer: -x, throttle: -y });
  }
  function onStickUp(e: React.PointerEvent) {
    if (stickOrigin.current.id !== e.pointerId) return;
    stickOrigin.current.id = -1;
    setStick({ x: 0, y: 0, on: false });
    handle.current?.setTouch({ steer: 0, throttle: 0 });
  }

  const shore = SHORES.find((s) => s.id === city)!;

  return (
    <main className="shore-shell">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      <header className="pointer-events-none absolute top-0 right-0 left-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <img src="/brand/futuret3ch.png" alt="Futuret3ch" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-[11px] tracking-[0.22em] text-[#d4a04a] uppercase">Futuret3ch</p>
            <p className="shore-title text-2xl text-[#efe8dc]">Three Shores</p>
          </div>
        </div>
        <img src="/brand/t3x-coin.png" alt="T3x" className="h-14 w-14 object-contain" />
      </header>

      {playing && (
        <div className="pointer-events-none absolute top-20 left-4 z-10">
          <p className="text-sm tracking-wide text-[#efe8dc]">{shore.name}</p>
          <p className="text-xs text-[#9aafbc]">
            T3x motes {motes.n}/{motes.total}
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] tracking-[0.16em] text-[#2ec8b0] uppercase">
            <div
              ref={arrowRef}
              className="grid h-8 w-8 place-items-center rounded-full border border-[#2ec8b0]/50"
            >
              <span className="-mt-0.5 block">▲</span>
            </div>
            Beacon
          </div>
        </div>
      )}

      {!playing && (
        <section className="absolute inset-0 z-20 flex items-end justify-center p-4 sm:items-center">
          <div className="w-full max-w-3xl rounded-2xl border border-[#efe8dc]/15 bg-[#071018]/80 p-5 shadow-2xl backdrop-blur-md sm:p-8">
            <p className="text-[11px] tracking-[0.28em] text-[#2ec8b0] uppercase">Supported by Futuret3ch</p>
            <h1 className="shore-title mt-2 text-5xl text-[#efe8dc] sm:text-7xl">Three Shores</h1>
            <p className="mt-3 max-w-xl text-sm text-[#c9beb0] sm:text-base">
              Run the roofs. Not a war game — a free climb across Melbourne, Sydney, and Brisbane.
              The T3x motes mark the line. The beacon ends it.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {SHORES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s.id)}
                  className={`rounded-xl border p-4 text-left ${
                    city === s.id
                      ? "border-[#d4a04a] bg-[#d4a04a]/10"
                      : "border-[#efe8dc]/15 bg-black/20"
                  }`}
                >
                  <span className="block text-[10px] tracking-[0.18em] text-[#9aafbc] uppercase">{s.place}</span>
                  <span className="shore-title mt-1 block text-2xl">{s.name}</span>
                  <span className="mt-2 block text-xs text-[#c9beb0]">{s.line}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={start}
                className="rounded-full bg-[#efe8dc] px-6 py-3 text-sm font-semibold tracking-wide text-[#071018]"
              >
                Start
              </button>
              <p className="text-xs text-[#9aafbc]">W run · A turn left · D turn right · Space jump · Shift sprint</p>
            </div>
          </div>
        </section>
      )}

      {playing && claimed && (
        <section className="absolute inset-0 z-20 grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2ec8b0]/40 bg-[#071018]/85 p-6 text-center backdrop-blur">
            <p className="text-[11px] tracking-[0.22em] text-[#d4a04a] uppercase">Shore claimed</p>
            <h2 className="shore-title mt-2 text-4xl">{shore.name}</h2>
            <p className="mt-2 text-sm text-[#c9beb0]">
              {motes.n} T3x motes gathered. The next shore is already lit.
            </p>
            <button
              type="button"
              onClick={nextShore}
              className="mt-5 rounded-full bg-[#2ec8b0] px-5 py-3 text-sm font-semibold text-[#071018]"
            >
              Next shore
            </button>
          </div>
        </section>
      )}

      {playing && !claimed && (
        <div className="absolute right-0 bottom-0 left-0 z-10 flex items-end justify-between p-4 sm:hidden">
          <div
            className="relative h-28 w-28 rounded-full border border-[#efe8dc]/30 bg-black/30"
            onPointerDown={onStickDown}
            onPointerMove={onStickMove}
            onPointerUp={onStickUp}
            onPointerCancel={onStickUp}
          >
            <div
              className="absolute top-1/2 left-1/2 h-12 w-12 rounded-full bg-[#efe8dc]/80"
              style={{
                transform: `translate(calc(-50% + ${stick.x * 36}px), calc(-50% + ${stick.y * 36}px))`,
              }}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="h-16 w-16 rounded-full border border-[#efe8dc]/30 bg-black/40 text-xs tracking-wide"
              onPointerDown={() => handle.current?.setTouch({ sprint: true })}
              onPointerUp={() => handle.current?.setTouch({ sprint: false })}
            >
              Run
            </button>
            <button
              type="button"
              className="h-16 w-16 rounded-full bg-[#efe8dc] text-sm font-semibold text-[#071018]"
              onPointerDown={() => handle.current?.requestJump()}
            >
              Jump
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
