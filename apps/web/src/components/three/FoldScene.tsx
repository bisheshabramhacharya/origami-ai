import { type DisplayMesh } from '@origami/fold'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export const PAPER_COLOUR = '#d9534f'
export const PAPER_BACK = '#fbfaf6'
const EDGE_COLOUR = { valley: '#2563eb', mountain: '#dc2626', crease: '#9ca3af' } as const

function Controls({ target, home, resetKey }: { target: THREE.Vector3; home: THREE.Vector3; resetKey: number }) {
  const { camera, gl, invalidate } = useThree()
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    camera.position.copy(home)
    controls.target.copy(target)
    controls.enablePan = false
    controls.enableDamping = false
    const redraw = () => invalidate()
    controls.addEventListener('change', redraw)
    controls.update()
    invalidate()
    return () => {
      controls.removeEventListener('change', redraw)
      controls.dispose()
    }
  }, [camera, gl, target, home, invalidate, resetKey])
  return null
}

function Paper({ mesh }: { mesh: DisplayMesh }) {
  const { geometry, lines } = useMemo(() => {
    const positions: number[] = []
    const normals: number[] = []
    for (const face of mesh.faces) {
      for (let i = 1; i < face.points.length - 1; i += 1) {
        for (const p of [face.points[0]!, face.points[i]!, face.points[i + 1]!]) {
          positions.push(p.x, p.y, p.z)
          normals.push(face.normal.x, face.normal.y, face.normal.z)
        }
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))

    const outline: number[] = []
    for (const face of mesh.faces) {
      for (let i = 0; i < face.points.length; i += 1) {
        const a = face.points[i]!
        const b = face.points[(i + 1) % face.points.length]!
        outline.push(a.x, a.y, a.z + 0.05, b.x, b.y, b.z + 0.05)
      }
    }
    const outlineGeometry = new THREE.BufferGeometry()
    outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outline, 3))

    const lines = (['valley', 'mountain', 'crease'] as const).map((kind) => {
      const pts: number[] = []
      for (const e of mesh.edges) if (e.kind === kind) pts.push(e.from.x, e.from.y, e.from.z + 0.1, e.to.x, e.to.y, e.to.z + 0.1)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      const l = new THREE.LineSegments(
        g,
        new THREE.LineDashedMaterial({
          color: EDGE_COLOUR[kind],
          dashSize: kind === 'crease' ? 1.5 : 4,
          gapSize: kind === 'mountain' ? 3 : 2,
        }),
      )
      l.computeLineDistances()
      return l
    })
    const edgeLines = new THREE.LineSegments(outlineGeometry, new THREE.LineBasicMaterial({ color: '#7a2a27', transparent: true, opacity: 0.55 }))
    return { geometry, lines: [edgeLines, ...lines] }
  }, [mesh])

  useEffect(
    () => () => {
      geometry.dispose()
      for (const l of lines) {
        l.geometry.dispose()
        const materials = Array.isArray(l.material) ? l.material : [l.material]
        for (const m of materials) m.dispose()
      }
    },
    [geometry, lines],
  )

  return (
    <group>
      <mesh geometry={geometry}>
        <meshLambertMaterial color={PAPER_COLOUR} side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={geometry}>
        <meshLambertMaterial color={PAPER_BACK} side={THREE.BackSide} />
      </mesh>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  )
}

export type SceneBox = DisplayMesh['box']

/**
 * Draws a display mesh from the fold engine. No geometry is worked out here. `frame` is the box the
 * camera frames (by default the mesh's own); a player passes one box for a whole Step so the view
 * does not jump. A new `resetKey` puts the camera back on the learner's side of the table.
 */
export function FoldScene({ mesh, label, frame, resetKey = 0 }: { mesh: DisplayMesh; label: string; frame?: SceneBox; resetKey?: number }) {
  const box = frame ?? mesh.box
  const centre = useMemo(
    () => new THREE.Vector3((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2),
    [box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ],
  )
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ, 10)
  const distance = size * 1.9
  const home = useMemo(
    () => new THREE.Vector3(centre.x, centre.y - distance * 0.35, centre.z + distance),
    [centre, distance],
  )
  return (
    <div role="img" aria-label={label} className="h-full w-full touch-none">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [home.x, home.y, home.z], fov: 35, near: 1, far: size * 20 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[centre.x - size, centre.y + size, centre.z + size * 2]} intensity={1.4} />
        <directionalLight position={[centre.x + size, centre.y - size, centre.z - size * 2]} intensity={0.8} />
        <Paper mesh={mesh} />
        <Controls target={centre} home={home} resetKey={resetKey} />
      </Canvas>
    </div>
  )
}
