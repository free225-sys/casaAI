import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, type Group, type Mesh } from "three";
import { arcPositions } from "./arcLayout";

function Edge({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([...from, ...to], 3));
    return g;
  }, [from, to]);

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial attach="material" color="#8891a8" transparent opacity={0.4} />
    </line>
  );
}

function StepNode({
  position, active, phase, onSelect,
}: {
  position: [number, number, number]; active: boolean; phase: number; onSelect: () => void;
}) {
  const mesh = useRef<Mesh>(null);
  const [x, y, z] = position;

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    mesh.current.position.y = y + Math.sin(clock.elapsedTime * 0.8 + phase) * 0.06;
  });

  const radius = active ? 0.22 : 0.13;
  const color = active ? "#2f63e0" : "#8891a8";

  return (
    <mesh
      ref={mesh}
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.75 : 0.12} roughness={0.35} />
    </mesh>
  );
}

/** Le groupe entier suit mollement le pointeur, comme le hero de la page
 * d'accueil — même vocabulaire de mouvement, pas de contrôle utilisateur
 * (pas d'OrbitControls) : contemplatif, pas manipulable. */
function RotatingPipeline({
  count, activeIndex, onSelect,
}: {
  count: number; activeIndex: number; onSelect: (i: number) => void;
}) {
  const group = useRef<Group>(null);
  const positions = useMemo(() => arcPositions(count), [count]);
  const pointer = useThree((state) => state.pointer);

  useFrame(() => {
    if (!group.current) return;
    const targetX = pointer.y * 0.08;
    const targetY = pointer.x * 0.12;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.04;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.04;
  });

  return (
    <group ref={group}>
      {positions.slice(0, -1).map((p, i) => (
        <Edge key={i} from={p} to={positions[i + 1]} />
      ))}
      {positions.map((p, i) => (
        <StepNode key={i} position={p} active={i === activeIndex} phase={i * 0.6} onSelect={() => onSelect(i)} />
      ))}
    </group>
  );
}

interface PipelineScene3DProps {
  stepCount: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}

/** Chargé dynamiquement par InteractiveStepPipeline — ne jamais l'importer
 * statiquement ailleurs (fait entrer three.js dans le chunk initial sinon),
 * et seulement à la demande explicite (bascule 2D/3D, jamais au chargement
 * de la page) : plus strict encore que le hero, qui charge dès l'accueil. */
export default function PipelineScene3D({ stepCount, activeIndex, onSelect }: PipelineScene3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 5.5], fov: 42 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 4, 5]} intensity={35} color="#ffffff" />
      <RotatingPipeline count={stepCount} activeIndex={activeIndex} onSelect={onSelect} />
    </Canvas>
  );
}
