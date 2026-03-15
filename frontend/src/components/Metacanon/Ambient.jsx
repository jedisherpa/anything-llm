const SHAFTS = [
  { left: "16%", top: "0%", height: "100%" },
  { left: "50%", top: "0%", height: "100%" },
  { left: "84%", top: "0%", height: "100%" },
];

const PARTICLES = [
  { left: "30%", top: "15%", size: 2, kind: "gold" },
  { left: "72%", top: "30%", size: 1.5, kind: "teal" },
  { left: "45%", top: "60%", size: 1, kind: "gold" },
  { left: "58%", top: "22%", size: 1.5, kind: "teal" },
];

export default function MetacanonAmbient() {
  return (
    <div className="metacanon-ambient-shell" aria-hidden="true">
      <div className="ambient-layer">
        {SHAFTS.map((shaft) => (
          <div
            key={`${shaft.left}-${shaft.top}`}
            className="light-shaft"
            style={{
              left: shaft.left,
              top: shaft.top,
              height: shaft.height,
            }}
          />
        ))}
        <svg
          className="sacred-geo"
          viewBox="0 0 1536 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="400" cy="200" r="1" fill="rgba(218,165,32,0.15)" />
          <circle cx="520" cy="340" r="0.8" fill="rgba(218,165,32,0.12)" />
          <circle cx="680" cy="180" r="1.2" fill="rgba(218,165,32,0.1)" />
          <circle cx="900" cy="250" r="0.8" fill="rgba(218,165,32,0.15)" />
          <circle cx="1050" cy="150" r="1" fill="rgba(218,165,32,0.1)" />
          <circle cx="1200" cy="300" r="0.7" fill="rgba(218,165,32,0.12)" />
          <circle cx="450" cy="280" r="0.8" fill="rgba(0,128,128,0.12)" />
          <circle cx="780" cy="350" r="1" fill="rgba(0,128,128,0.1)" />
          <circle cx="1000" cy="400" r="0.7" fill="rgba(0,128,128,0.12)" />
          <line
            x1="400"
            y1="200"
            x2="520"
            y2="340"
            stroke="rgba(218,165,32,0.04)"
            strokeWidth="0.5"
          />
          <line
            x1="520"
            y1="340"
            x2="680"
            y2="180"
            stroke="rgba(218,165,32,0.03)"
            strokeWidth="0.5"
          />
          <line
            x1="680"
            y1="180"
            x2="900"
            y2="250"
            stroke="rgba(218,165,32,0.04)"
            strokeWidth="0.5"
          />
          <line
            x1="900"
            y1="250"
            x2="1050"
            y2="150"
            stroke="rgba(218,165,32,0.03)"
            strokeWidth="0.5"
          />
          <line
            x1="450"
            y1="280"
            x2="780"
            y2="350"
            stroke="rgba(0,128,128,0.03)"
            strokeWidth="0.5"
          />
          <line
            x1="780"
            y1="350"
            x2="1000"
            y2="400"
            stroke="rgba(0,128,128,0.03)"
            strokeWidth="0.5"
          />
          <polygon
            points="768,320 808,343 808,389 768,412 728,389 728,343"
            stroke="rgba(218,165,32,0.025)"
            strokeWidth="0.5"
            fill="none"
          />
          <polygon
            points="768,290 828,323 828,399 768,432 708,399 708,323"
            stroke="rgba(0,128,128,0.02)"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
        <div className="particle-field">
          {PARTICLES.map((particle) => (
            <span
              key={`${particle.left}-${particle.top}-${particle.kind}`}
              className={`ambient-particle ambient-particle--${particle.kind}`}
              style={{
                left: particle.left,
                top: particle.top,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
