type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  rot: number
  spin: number
  kind: number
  color: string
}

export type ParticleField = {
  resize(width: number, height: number): void
  burst(amount: number): void
  frame(dt: number): void
  alive(): boolean
  clear(): void
}

export function createParticles(
  canvas: HTMLCanvasElement,
  colors: readonly string[],
): ParticleField {
  const context = canvas.getContext("2d", { alpha: true })
  const particles: Particle[] = []
  let width = 1
  let height = 1
  let dpr = 1

  function resize(nextWidth: number, nextHeight: number): void {
    width = Math.max(1, nextWidth)
    height = Math.max(1, nextHeight)
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    if (context) context.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function burst(amount: number): void {
    if (!context) return
    const count = Math.max(0, Math.floor(amount))
    for (let index = 0; index < count; index += 1) {
      if (particles.length >= 70) return
      const color = colors[Math.floor(Math.random() * colors.length)] ?? "#e23b2f"
      particles.push({
        x: Math.random() * width,
        y: height * (0.35 + Math.random() * 0.65),
        vx: -28 + Math.random() * 56,
        vy: -46 - Math.random() * 70,
        life: 0,
        max: 0.7 + Math.random() * 1.1,
        size: 3 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        spin: -2.4 + Math.random() * 4.8,
        kind: Math.floor(Math.random() * 3),
        color,
      })
    }
  }

  function frame(dt: number): void {
    if (!context) return
    const step = Math.min(Math.max(dt, 0), 0.05)
    context.clearRect(0, 0, width, height)
    let index = 0
    while (index < particles.length) {
      const particle = particles[index]
      if (!particle) {
        index += 1
        continue
      }
      particle.life += step
      if (particle.life >= particle.max) {
        const last = particles.pop()
        if (last && index < particles.length) particles[index] = last
        continue
      }
      particle.x += particle.vx * step
      particle.y += particle.vy * step
      particle.vy += 18 * step
      particle.rot += particle.spin * step
      const fade = 1 - particle.life / particle.max
      drawParticle(context, particle, fade)
      index += 1
    }
  }

  return {
    resize,
    burst,
    frame,
    alive(): boolean {
      return particles.length > 0
    },
    clear(): void {
      particles.length = 0
      if (context) context.clearRect(0, 0, width, height)
    },
  }
}

function drawParticle(context: CanvasRenderingContext2D, particle: Particle, fade: number): void {
  context.save()
  context.translate(particle.x, particle.y)
  context.rotate(particle.rot)
  context.globalAlpha = Math.max(0, fade)
  context.fillStyle = particle.color
  if (particle.kind === 0) {
    context.beginPath()
    context.ellipse(0, 0, particle.size, particle.size * 0.62, 0, 0, Math.PI * 2)
    context.fill()
  } else if (particle.kind === 1) {
    context.fillRect(-particle.size * 0.16, -particle.size, particle.size * 0.32, particle.size * 1.35)
    context.beginPath()
    context.ellipse(-particle.size * 0.05, particle.size * 0.28, particle.size * 0.42, particle.size * 0.28, -0.5, 0, Math.PI * 2)
    context.fill()
  } else {
    context.fillRect(-particle.size, -1.1, particle.size * 2, 2.2)
  }
  context.restore()
}
