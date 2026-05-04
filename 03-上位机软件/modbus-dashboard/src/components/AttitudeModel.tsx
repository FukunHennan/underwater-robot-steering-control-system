function AttitudeModel({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  const L = 180
  const R = 35
  const propAngle = yaw * 3

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full h-80 rounded-xl overflow-hidden"
        style={{
          perspective: '1000px',
          background: 'linear-gradient(180deg, rgba(10,25,50,0.95) 0%, rgba(5,15,35,0.98) 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.3) 0%, transparent 70%)',
        }} />

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${yaw}deg) rotateX(${-pitch}deg) rotateZ(${-roll}deg)`,
            transition: 'transform 120ms ease-out',
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15) * Math.PI / 180
            const x = Math.cos(angle) * R
            const y = Math.sin(angle) * R
            const brightness = 0.3 + 0.4 * Math.cos(angle)
            return (
              <div key={`side-${i}`} style={{
                position: 'absolute',
                width: L,
                height: 1,
                transformStyle: 'preserve-3d',
                transform: `translateY(${y}px) translateZ(${x}px) rotateX(90deg)`,
              }}>
                <div style={{
                  width: L,
                  height: R * 2,
                  background: `linear-gradient(90deg,
                    rgba(30,60,110,${brightness * 0.8}) 0%,
                    rgba(40,80,140,${brightness}) 50%,
                    rgba(25,50,90,${brightness * 0.8}) 100%)`,
                  borderLeft: `1px solid rgba(56,189,248,${brightness * 0.3})`,
                  borderRight: `1px solid rgba(56,189,248,${brightness * 0.3})`,
                  opacity: 0.85,
                }} />
              </div>
            )
          })}

          <div style={{
            position: 'absolute',
            width: R * 2,
            height: R * 2,
            transformStyle: 'preserve-3d',
            transform: `translateX(${L / 2}px) translateZ(${R}px)`,
          }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 15) * Math.PI / 180
              const y = Math.sin(angle) * R
              const z = Math.cos(angle) * R
              const brightness = 0.4 + 0.5 * Math.cos(angle)
              return (
                <div key={`nose-${i}`} style={{
                  position: 'absolute',
                  width: 1,
                  height: R * 2,
                  transformStyle: 'preserve-3d',
                  transform: `translateY(${y}px) translateZ(${z}px) rotateY(90deg)`,
                }}>
                  <div style={{
                    width: R * 0.6,
                    height: R * 2,
                    background: `linear-gradient(90deg,
                      rgba(56,189,248,${brightness * 0.4}) 0%,
                      rgba(40,80,140,${brightness * 0.6}) 100%)`,
                    borderRadius: '0 50% 50% 0',
                    opacity: 0.9,
                  }} />
                </div>
              )
            })}
          </div>

          <div style={{
            position: 'absolute',
            width: R * 2,
            height: R * 2,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2}px) translateZ(${R}px) rotateY(90deg)`,
          }}>
            <div style={{
              width: R * 2,
              height: R * 2,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(25,50,90,0.9) 0%, rgba(15,35,65,0.95) 100%)',
              border: '2px solid rgba(56,189,248,0.3)',
              boxShadow: 'inset 0 0 20px rgba(56,189,248,0.1)',
            }} />
          </div>

          <div style={{
            position: 'absolute',
            width: 80,
            height: 40,
            transformStyle: 'preserve-3d',
            transform: `translateX(20px) translateY(${-R * 0.6}px) translateZ(0)`,
          }}>
            <div style={{
              width: 80,
              height: 40,
              background: 'radial-gradient(ellipse at 50% 80%, rgba(56,189,248,0.25) 0%, rgba(30,60,110,0.15) 70%)',
              borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
              border: '1px solid rgba(56,189,248,0.3)',
              borderBottom: 'none',
            }} />
            <div className="absolute" style={{ left: 20, top: 10, width: 10, height: 12, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
            <div className="absolute" style={{ left: 35, top: 8, width: 10, height: 12, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
            <div className="absolute" style={{ left: 50, top: 10, width: 10, height: 12, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
          </div>

          <div style={{
            position: 'absolute',
            width: 20,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(${L / 2 + 10}px) translateZ(0) rotateY(90deg)`,
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(239,68,68,0.4) 0%, rgba(150,20,20,0.6) 50%, rgba(80,10,10,0.8) 100%)',
              border: '2px solid rgba(239,68,68,0.5)',
              boxShadow: '0 0 15px rgba(239,68,68,0.3), inset 0 0 8px rgba(0,0,0,0.5)',
            }} />
            <div className="absolute inset-2 rounded-full" style={{ border: '1px solid rgba(239,68,68,0.3)' }} />
          </div>

          <div style={{
            position: 'absolute',
            width: 16,
            height: 16,
            transformStyle: 'preserve-3d',
            transform: `translateX(${L / 2 + 5}px) translateY(15px) translateZ(0) rotateY(90deg)`,
          }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(251,191,36,0.5) 0%, rgba(200,150,30,0.3) 60%)',
              border: '1px solid rgba(251,191,36,0.4)',
              boxShadow: '0 0 20px rgba(251,191,36,0.4)',
            }} />
            <div style={{
              position: 'absolute',
              left: 16,
              top: -10,
              width: 50,
              height: 36,
              background: 'linear-gradient(90deg, rgba(251,191,36,0.15) 0%, transparent 100%)',
              clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 70%)',
            }} />
          </div>

          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(30px) translateY(${-R - 8}px) translateZ(0)`,
          }}>
            <div style={{ width: 30, height: 20, background: 'rgba(139,92,246,0.2)', borderRadius: 4, border: '1px solid rgba(139,92,246,0.4)' }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${propAngle}deg)` }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(30px) translateY(${R + 8}px) translateZ(0)`,
          }}>
            <div style={{ width: 30, height: 20, background: 'rgba(139,92,246,0.2)', borderRadius: 4, border: '1px solid rgba(139,92,246,0.4)' }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${-propAngle}deg)` }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(-30px) translateZ(${-R - 8}px) rotateX(90deg)`,
          }}>
            <div style={{ width: 30, height: 20, background: 'rgba(139,92,246,0.2)', borderRadius: 4, border: '1px solid rgba(139,92,246,0.4)' }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${-propAngle * 0.8}deg)` }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(-30px) translateZ(${R + 8}px) rotateX(90deg)`,
          }}>
            <div style={{ width: 30, height: 20, background: 'rgba(139,92,246,0.2)', borderRadius: 4, border: '1px solid rgba(139,92,246,0.4)' }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${propAngle * 0.8}deg)` }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          <div style={{
            position: 'absolute',
            width: 50,
            height: 50,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2 - 15}px) translateZ(${R}px) rotateY(90deg)`,
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, rgba(168,130,76,0.6) 0%, rgba(100,80,40,0.8) 100%)', border: '1px solid rgba(168,130,76,0.5)', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${propAngle}deg)` }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`blade-${i}`} style={{ position: 'absolute', width: 20, height: 6, background: 'linear-gradient(90deg, rgba(168,130,76,0.7) 0%, rgba(168,130,76,0.2) 100%)', borderRadius: '0 50% 50% 0', transform: `rotate(${i * 90}deg) translateX(8px)` }} />
              ))}
            </div>
          </div>

          <div style={{ position: 'absolute', width: 35, height: 15, transformStyle: 'preserve-3d', transform: `translateX(${-L / 2 + 10}px) translateY(${-R - 5}px) translateZ(0)` }}>
            <div style={{ width: 35, height: 15, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }} />
          </div>
          <div style={{ position: 'absolute', width: 35, height: 15, transformStyle: 'preserve-3d', transform: `translateX(${-L / 2 + 10}px) translateY(${R + 5}px) translateZ(0)` }}>
            <div style={{ width: 35, height: 15, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }} />
          </div>
          <div style={{ position: 'absolute', width: 30, height: 20, transformStyle: 'preserve-3d', transform: `translateX(${-L / 2 + 15}px) translateY(0) translateZ(${-R - 5}px) rotateX(90deg)` }}>
            <div style={{ width: 30, height: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }} />
          </div>

          <div style={{ position: 'absolute', width: 3, height: 15, transformStyle: 'preserve-3d', transform: `translateX(50px) translateY(${-R - 15}px) translateZ(0)` }}>
            <div style={{ width: 3, height: 15, background: 'linear-gradient(180deg, rgba(239,68,68,0.6) 0%, rgba(100,100,100,0.4) 100%)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: -3, left: -2, width: 7, height: 7, borderRadius: '50%', background: 'rgba(239,68,68,0.6)', boxShadow: '0 0 10px rgba(239,68,68,0.4)' }} />
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`bubble-${i}`} className="absolute rounded-full" style={{
              width: 3 + Math.random() * 5,
              height: 3 + Math.random() * 5,
              left: `${10 + Math.random() * 80}%`,
              top: `${20 + Math.random() * 60}%`,
              background: `rgba(56,189,248,${0.1 + Math.random() * 0.2})`,
              animation: `bubbleFloat ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }} />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-20 opacity-20" style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.1) 100%)',
          backgroundImage: `repeating-linear-gradient(90deg, rgba(56,189,248,0.2) 0px, rgba(56,189,248,0.2) 1px, transparent 1px, transparent 40px),
                           repeating-linear-gradient(0deg, rgba(56,189,248,0.2) 0px, rgba(56,189,248,0.2) 1px, transparent 1px, transparent 40px)`,
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom',
        }} />

        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/40 text-[10px] text-[--fg-muted] font-mono">
          Roll {roll.toFixed(1)}° · Pitch {pitch.toFixed(1)}° · Yaw {yaw.toFixed(1)}°
        </div>
      </div>

      <style>{`
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.2); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

export default AttitudeModel
