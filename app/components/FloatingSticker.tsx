"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function FloatingSticker({
    src,
    alt,
    size = 200,
}: {
    src: string;
    alt: string;
    size?: number;
}) {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState(0);
    const [ready, setReady] = useState(false);
    const rotationRef = useRef(0);

    const posRef = useRef({ x: 0, y: 0 });
    const velRef = useRef({ x: 1.2, y: 0.7 });
    const draggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const lastPointerRef = useRef({ x: 0, y: 0 });
    const lastPointerTimeRef = useRef(0);
    const prevPointerRef = useRef({ x: 0, y: 0, t: 0 });
    const rafRef = useRef<number | null>(null);
    const sizeRef = useRef(size);

    useEffect(() => {
        sizeRef.current = size;
    }, [size]);

    useEffect(() => {
        const startX = window.innerWidth * 0.72 - size / 2;
        const startY = window.innerHeight * 0.18 - size / 2;
        posRef.current = { x: startX, y: startY };
        setPos({ x: startX, y: startY });
        setReady(true);
    }, []);

    useEffect(() => {
        if (!ready) return;

        const tick = () => {
            if (!draggingRef.current) {
                const w = window.innerWidth;
                const h = window.innerHeight;
                const s = sizeRef.current;

                posRef.current.x += velRef.current.x;
                posRef.current.y += velRef.current.y;

                if (posRef.current.x <= 0) {
                    posRef.current.x = 0;
                    velRef.current.x = Math.abs(velRef.current.x) * 0.85;
                } else if (posRef.current.x + s >= w) {
                    posRef.current.x = w - s;
                    velRef.current.x = -Math.abs(velRef.current.x) * 0.85;
                }

                if (posRef.current.y <= 0) {
                    posRef.current.y = 0;
                    velRef.current.y = Math.abs(velRef.current.y) * 0.85;
                } else if (posRef.current.y + s >= h) {
                    posRef.current.y = h - s;
                    velRef.current.y = -Math.abs(velRef.current.y) * 0.85;
                }

                velRef.current.x *= 0.996;
                velRef.current.y *= 0.996;

                const speed = Math.sqrt(velRef.current.x ** 2 + velRef.current.y ** 2);
                if (speed < 0.01) {
                    velRef.current.x = 0;
                    velRef.current.y = 0;
                    const angle = Math.random() * Math.PI * 2;
                    // velRef.current.x += Math.cos(angle) * 0.08;
                    // velRef.current.y += Math.sin(angle) * 0.08;
                }

                const targetRot = velRef.current.x * 24;
                rotationRef.current += (targetRot - rotationRef.current) * 0.08;

                setPos({ x: posRef.current.x, y: posRef.current.y });
                setRotation(rotationRef.current);
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [ready]);

    const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        draggingRef.current = true;
        dragOffsetRef.current = {
            x: e.clientX - posRef.current.x,
            y: e.clientY - posRef.current.y,
        };
        prevPointerRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        lastPointerTimeRef.current = e.timeStamp;
        velRef.current = { x: 0, y: 0 };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        posRef.current = { x: newX, y: newY };
        setPos({ x: newX, y: newY });

        const dt = e.timeStamp - prevPointerRef.current.t;
        if (dt > 0) {
            velRef.current = {
                x: (e.clientX - prevPointerRef.current.x) / dt * 8,
                y: (e.clientY - prevPointerRef.current.y) / dt * 8,
            };
        }
        prevPointerRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };

    const onPointerUp = () => {
        draggingRef.current = false;
        const speed = Math.sqrt(velRef.current.x ** 2 + velRef.current.y ** 2);
        if (speed > 18) {
            const scale = 18 / speed;
            velRef.current.x *= scale;
            velRef.current.y *= scale;
        }
    };

    if (!ready) return null;

    return (
        <div
            className="fixed touch-none"
            style={{
                left: pos.x,
                top: pos.y,
                width: size,
                height: size,
                cursor: draggingRef.current ? "grabbing" : "grab",
                userSelect: "none",
                willChange: "transform",
                transform: `rotate(${rotation}deg)`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <Image
                src={src}
                alt={alt}
                width={size}
                height={size}
                draggable={true}
                className="w-full h-full object-contain drop-shadow-2xl"
            />
        </div>
    );
}
