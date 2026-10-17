import { Bodies, Body, Composite, Engine, Query } from "matter-js";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../../domain/task";
import { getBalloonDiameter } from "../../domain/capacity";

interface BalloonContainerProps {
  tasks: Task[];
  completingId?: string | null;
  onSelect: (task: Task) => void;
}

interface SavedPosition {
  xRatio: number;
  y: number;
}

const WALL_THICKNESS = 80;
// Keep circles clear of the container's rounded clipping edge and 1px border.
const EDGE_INSET = 1;
const STAGE_HEIGHT = 320;
const fitDiameter = (diameter: number, width: number) =>
  Math.min(diameter, Math.max(1, width - 4));

const BalloonContainer = ({
  tasks,
  completingId,
  onSelect,
}: BalloonContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(new Map<string, HTMLDivElement>());
  const savedPositionsRef = useRef(new Map<string, SavedPosition>());
  const [width, setWidth] = useState(0);

  const balloons = useMemo(
    () =>
      tasks.map((task, index) => ({
        task,
        diameter: getBalloonDiameter(task.carryoverCount),
        tone: ["coral", "blue", "mint"][index % 3],
      })),
    [tasks],
  );
  const signature = balloons
    .map(({ task, diameter }) => `${task.id}:${diameter}`)
    .join("|");
  const balloonsRef = useRef(balloons);
  balloonsRef.current = balloons;
  const stageHeight = STAGE_HEIGHT;

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const updateWidth = () => setWidth(node.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (width <= 0 || !balloons.length) return;
    const currentBalloons = balloonsRef.current;

    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.x = 0;
    engine.gravity.y = 1;

    const leftWall = Bodies.rectangle(
      EDGE_INSET - WALL_THICKNESS / 2,
      stageHeight / 2,
      WALL_THICKNESS,
      stageHeight + WALL_THICKNESS * 2,
      { isStatic: true, friction: 0.9 },
    );
    const rightWall = Bodies.rectangle(
      width - EDGE_INSET + WALL_THICKNESS / 2,
      stageHeight / 2,
      WALL_THICKNESS,
      stageHeight + WALL_THICKNESS * 2,
      { isStatic: true, friction: 0.9 },
    );
    const floor = Bodies.rectangle(
      width / 2,
      stageHeight - EDGE_INSET + WALL_THICKNESS / 2,
      width + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      { isStatic: true, friction: 0.9 },
    );
    Composite.add(engine.world, [leftWall, rightWall, floor]);

    const bodies = new Map<string, Body>();
    const placedBodies: Body[] = [];
    const largestDiameter = Math.max(
      ...currentBalloons.map(({ diameter }) => fitDiameter(diameter, width)),
    );
    for (const { task, diameter: requestedDiameter } of currentBalloons) {
      const diameter = fitDiameter(requestedDiameter, width);
      const radius = diameter / 2;
      const saved = savedPositionsRef.current.get(task.id);
      let body: Body | undefined;
      const makeBody = (x: number, y: number) =>
        Bodies.circle(x, y, radius, {
          restitution: 0.08,
          friction: 0.48,
          frictionStatic: 0.8,
          frictionAir: 0.018,
          sleepThreshold: 55,
        });

      if (saved) {
        const x = Math.max(
          radius + EDGE_INSET,
          Math.min(width - radius - EDGE_INSET, saved.xRatio * width),
        );
        const y = Math.max(
          radius + EDGE_INSET,
          Math.min(stageHeight - radius - EDGE_INSET, saved.y),
        );
        const candidate = makeBody(x, y);
        if (Query.collides(candidate, placedBodies).length === 0)
          body = candidate;
      }

      for (let attempt = 0; !body && attempt < 48; attempt += 1) {
        const x =
          radius +
          EDGE_INSET +
          Math.random() * Math.max(0, width - diameter - EDGE_INSET * 2);
        const y =
          radius +
          EDGE_INSET +
          Math.random() * Math.max(0, stageHeight - diameter - EDGE_INSET * 2);
        const candidate = makeBody(x, y);
        if (Query.collides(candidate, placedBodies).length === 0) {
          body = candidate;
          Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.7, y: 0 });
        }
      }

      if (!body) {
        const columns = Math.max(1, Math.floor(width / largestDiameter));
        const rows = Math.ceil(balloons.length / columns);
        for (let row = 0; !body && row < rows + 1; row += 1) {
          for (let column = 0; !body && column < columns; column += 1) {
            const x =
              columns === 1
                ? width / 2
                : radius +
                  EDGE_INSET +
                  ((width - diameter - EDGE_INSET * 2) * column) /
                    (columns - 1);
            const y = radius + EDGE_INSET + row * (largestDiameter + 2);
            if (y > stageHeight - radius - EDGE_INSET) continue;
            const candidate = makeBody(x, y);
            if (Query.collides(candidate, placedBodies).length === 0)
              body = candidate;
          }
        }
      }

      if (!body) {
        body = makeBody(width / 2, stageHeight - radius - EDGE_INSET);
        Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.7, y: 0 });
      }

      bodies.set(task.id, body);
      placedBodies.push(body);
    }
    Composite.add(engine.world, placedBodies);

    let frameId = 0;
    let lastTime = 0;
    let timeBank = 0;
    const renderFrame = (time: number) => {
      const elapsed = lastTime
        ? Math.min(time - lastTime, 1000 / 30)
        : 1000 / 60;
      lastTime = time;
      timeBank += elapsed;
      const fixedStep = 1000 / 60;
      let stepCount = 0;
      while (timeBank >= fixedStep && stepCount < 2) {
        Engine.update(engine, fixedStep);
        timeBank -= fixedStep;
        stepCount += 1;
      }
      for (const { task } of currentBalloons) {
        const body = bodies.get(task.id);
        const element = elementsRef.current.get(task.id);
        if (!body || !element) continue;
        element.style.left = `${body.position.x}px`;
        element.style.top = `${body.position.y}px`;
        savedPositionsRef.current.set(task.id, {
          xRatio: body.position.x / width,
          y: body.position.y,
        });
      }
      frameId = placedBodies.every((body) => body.isSleeping)
        ? 0
        : requestAnimationFrame(renderFrame);
    };
    frameId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(frameId);
      for (const { task } of currentBalloons) {
        const body = bodies.get(task.id);
        if (body)
          savedPositionsRef.current.set(task.id, {
            xRatio: body.position.x / width,
            y: body.position.y,
          });
      }
      Engine.clear(engine);
    };
  }, [signature, stageHeight, width]);

  return (
    <div
      ref={containerRef}
      className={`balloon-container${tasks.length ? " balloon-container--physics" : ""}`}
      style={{ height: `${stageHeight + 2}px` }}
    >
      {balloons.map(({ task, diameter, tone }) => (
        <div
          key={task.id}
          ref={(element) => {
            if (element) elementsRef.current.set(task.id, element);
            else elementsRef.current.delete(task.id);
          }}
          className={`balloon-item${task.id === completingId ? " is-shrinking" : ""}`}
          data-tone={tone}
          style={
            {
              "--balloon-size": `${fitDiameter(diameter, width)}px`,
            } as React.CSSProperties
          }
        >
          <button
            type="button"
            className="balloon-item__hit"
            onClick={() => onSelect(task)}
            aria-label={`${task.title}，未完成 ${task.carryoverCount} 个周期`}
          >
            <span className="balloon" aria-hidden="true" />
          </button>
          <span className="balloon-card__title">{task.title}</span>
          <span className="balloon-card__meta">
            {task.load ?? "—"} 点
            {task.carryoverCount ? ` · ${task.carryoverCount} 周期` : ""}
          </span>
        </div>
      ))}
      {!tasks.length && (
        <div className="empty-state">
          <span>☀️</span>
          <h3>今天的气球都放轻了</h3>
          <p>安排一件小事，开始新的一天。</p>
        </div>
      )}
    </div>
  );
};

export default BalloonContainer;
