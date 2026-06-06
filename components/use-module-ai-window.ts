"use client"

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type PointerEvent } from "react"

interface WindowBounds {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

interface ViewportSize {
  readonly height: number
  readonly width: number
}

interface Interaction {
  readonly bounds: WindowBounds
  readonly pointerX: number
  readonly pointerY: number
  readonly type: "move" | "resize"
}

const DEFAULT_HEIGHT = 620
const DEFAULT_WIDTH = 576
const MIN_HEIGHT = 420
const MIN_WIDTH = 360
const VIEWPORT_MARGIN = 12

const DEFAULT_BOUNDS: WindowBounds = {
  height: DEFAULT_HEIGHT,
  left: VIEWPORT_MARGIN,
  top: VIEWPORT_MARGIN,
  width: DEFAULT_WIDTH,
}

export function useModuleAiWindow(open: boolean) {
  const interactionRef = useRef<Interaction | null>(null)
  const [bounds, setBounds] = useState<WindowBounds>(DEFAULT_BOUNDS)

  useEffect(() => {
    if (open) setBounds(createCenteredBounds(readViewport()))
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction) return
      setBounds(readNextBounds(interaction, event))
    }
    const handlePointerUp = () => {
      interactionRef.current = null
    }
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [open])

  return {
    onMovePointerDown: createPointerDownHandler("move", bounds, interactionRef),
    onResizePointerDown: createPointerDownHandler("resize", bounds, interactionRef),
    style: createWindowStyle(bounds),
  }
}

function createPointerDownHandler(
  type: Interaction["type"],
  bounds: WindowBounds,
  interactionRef: MutableRefObject<Interaction | null>,
) {
  return (event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    interactionRef.current = {
      bounds,
      pointerX: event.clientX,
      pointerY: event.clientY,
      type,
    }
  }
}

function readNextBounds(interaction: Interaction, event: globalThis.PointerEvent): WindowBounds {
  const deltaX = event.clientX - interaction.pointerX
  const deltaY = event.clientY - interaction.pointerY
  if (interaction.type === "resize") {
    return resizeBounds(interaction.bounds, deltaX, deltaY, readViewport())
  }
  return moveBounds(interaction.bounds, deltaX, deltaY, readViewport())
}

function moveBounds(bounds: WindowBounds, deltaX: number, deltaY: number, viewport: ViewportSize): WindowBounds {
  const maxLeft = viewport.width - bounds.width - VIEWPORT_MARGIN
  const maxTop = viewport.height - bounds.height - VIEWPORT_MARGIN
  return {
    ...bounds,
    left: clamp(bounds.left + deltaX, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxLeft)),
    top: clamp(bounds.top + deltaY, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxTop)),
  }
}

function resizeBounds(bounds: WindowBounds, deltaX: number, deltaY: number, viewport: ViewportSize): WindowBounds {
  const maxWidth = Math.max(MIN_WIDTH, viewport.width - bounds.left - VIEWPORT_MARGIN)
  const maxHeight = Math.max(MIN_HEIGHT, viewport.height - bounds.top - VIEWPORT_MARGIN)
  return {
    ...bounds,
    height: clamp(bounds.height + deltaY, MIN_HEIGHT, maxHeight),
    width: clamp(bounds.width + deltaX, MIN_WIDTH, maxWidth),
  }
}

function createCenteredBounds(viewport: ViewportSize): WindowBounds {
  const width = clamp(DEFAULT_WIDTH, MIN_WIDTH, Math.max(MIN_WIDTH, viewport.width - VIEWPORT_MARGIN * 2))
  const height = clamp(DEFAULT_HEIGHT, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewport.height - VIEWPORT_MARGIN * 2))
  return {
    height,
    left: Math.max(VIEWPORT_MARGIN, Math.round((viewport.width - width) / 2)),
    top: Math.max(VIEWPORT_MARGIN, Math.round((viewport.height - height) / 2)),
    width,
  }
}

function createWindowStyle(bounds: WindowBounds): CSSProperties {
  return {
    height: `${bounds.height}px`,
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
  }
}

function readViewport(): ViewportSize {
  return {
    height: window.innerHeight,
    width: window.innerWidth,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
