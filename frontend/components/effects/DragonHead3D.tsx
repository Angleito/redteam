'use client'

import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMouseTracking } from '@/hooks/useMouseTracking'
import { useWebGLRecovery } from '../../utils/webglRecovery'
import { useDragonModel } from '@/hooks/useDragonModel'

interface DragonHead3DProps {
  className?: string
  intensity?: number
  enableEyeTracking?: boolean
  lightningActive?: boolean
  onLoad?: () => void
  onError?: (error: Error) => void
  onFallback?: () => void
}

// Eye tracking component that handles the dragon head mesh
function DragonHeadMesh({ 
  enableEyeTracking = true, 
  lightningActive = false 
}: { 
  enableEyeTracking: boolean
  lightningActive: boolean 
}) {
  const meshRef = useRef<THREE.Group>(null)
  const leftEyeRef = useRef<THREE.Object3D>(null)
  const rightEyeRef = useRef<THREE.Object3D>(null)
  const blinkRef = useRef({ isBlinking: false, blinkTimer: 0, nextBlink: Math.random() * 5 + 3 })
  
  // Load the OBJ model using centralized cache service
  const { model: obj, isLoading, error } = useDragonModel('/models/dragon_head.obj', {
    onLoad: (loadedModel) => {
      console.log('🐉 Dragon head model loaded successfully:', loadedModel)
    },
    onError: (loadError) => {
      console.error('🔴 Dragon head model load failed:', loadError)
    }
  })
  
  // Mouse tracking for eye movement
  const { mousePosition, isMouseActive } = useMouseTracking(undefined, {
    smoothing: true,
    smoothingFactor: 0.08
  })

  // Clone the model to avoid issues with reusing geometry
  const clonedObj = useMemo(() => {
    if (!obj) return null
    
    const cloned = obj.clone()
    
    // Scale and position the dragon head
    cloned.scale.setScalar(0.8) // Adjust scale as needed
    cloned.position.set(0, -20, -10) // Position head so eyes are at center, moved back and down
    cloned.rotation.set(0.1, 0, 0) // Slight downward angle
    
    // Apply dark, metallic materials
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(0.7, 0.15, 0.1), // Rich crimson red
          shininess: 40,
          specular: new THREE.Color(0.9, 0.6, 0.2), // Enhanced golden highlights
        })
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    
    return cloned
  }, [obj])
  
  // Show loading state or error
  if (isLoading) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhongMaterial color="#666666" wireframe />
      </mesh>
    )
  }
  
  if (error || !clonedObj) {
    return (
      <mesh>
        <coneGeometry args={[1, 2, 8]} />
        <meshPhongMaterial color="#ff6600" />
      </mesh>
    )
  }

  // Calculate eye rotation based on mouse position
  const calculateEyeRotation = (mouseX: number, mouseY: number) => {
    if (!enableEyeTracking || !isMouseActive) {
      return { x: 0, y: 0 }
    }

    // Convert screen coordinates to normalized device coordinates
    const normalizedX = (mouseX / window.innerWidth) * 2 - 1
    const normalizedY = -(mouseY / window.innerHeight) * 2 + 1
    
    // Limit eye movement range (eyes can't rotate infinitely)
    const maxRotation = Math.PI / 4 // 45 degrees max
    const eyeRotationX = normalizedY * maxRotation * 0.5 // Increased vertical movement
    const eyeRotationY = normalizedX * maxRotation * 0.7 // More horizontal movement
    
    return { x: eyeRotationX, y: eyeRotationY }
  }

  // Animation loop
  useFrame((state, delta) => {
    if (!meshRef.current) return

    const { x: eyeRotX, y: eyeRotY } = calculateEyeRotation(mousePosition.x, mousePosition.y)
    
    // Handle blinking animation
    blinkRef.current.blinkTimer += delta
    
    if (!blinkRef.current.isBlinking && blinkRef.current.blinkTimer >= blinkRef.current.nextBlink) {
      blinkRef.current.isBlinking = true
      blinkRef.current.blinkTimer = 0
    }
    
    if (blinkRef.current.isBlinking) {
      if (blinkRef.current.blinkTimer >= 0.15) { // Blink duration
        blinkRef.current.isBlinking = false
        blinkRef.current.blinkTimer = 0
        blinkRef.current.nextBlink = Math.random() * 8 + 4 // Next blink in 4-12 seconds
      }
    }

    // Apply eye rotations (we'll need to identify eye objects in the mesh)
    // For now, we'll apply subtle head movement to simulate eye tracking
    if (isMouseActive && enableEyeTracking) {
      meshRef.current.rotation.x = 0.1 + eyeRotX * 0.4
      meshRef.current.rotation.y = eyeRotY * 0.6
    } else {
      // Return to neutral position when mouse is inactive
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0.1, delta * 2)
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, delta * 2)
    }

    // Subtle breathing animation
    const breathe = Math.sin(state.clock.elapsedTime * 0.8) * 0.02
    meshRef.current.scale.setScalar(0.8 + breathe)

    // Lightning flash effect on materials
    if (lightningActive) {
      meshRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
          child.material.emissive.setHex(0x664422) // Enhanced golden-red glow during lightning
        }
      })
    } else {
      meshRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
          child.material.emissive.setHex(0x000000) // No glow normally
        }
      })
    }
  })

  return (
    <group ref={meshRef}>
      <primitive object={clonedObj} />
    </group>
  )
}

// Lighting setup for the dragon
function DragonLighting({ lightningActive = false }: { lightningActive: boolean }) {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const directionalRef = useRef<THREE.DirectionalLight>(null)
  const rimLightRef = useRef<THREE.DirectionalLight>(null)

  useFrame((state) => {
    // Enhance lighting during lightning strikes
    if (ambientRef.current) {
      ambientRef.current.intensity = lightningActive ? 0.8 : 0.3
    }
    
    if (directionalRef.current) {
      directionalRef.current.intensity = lightningActive ? 2.5 : 1.2
    }

    if (rimLightRef.current) {
      rimLightRef.current.intensity = lightningActive ? 1.5 : 0.6
    }
  })

  return (
    <>
      {/* Ambient light for overall illumination */}
      <ambientLight ref={ambientRef} color="#5a4545" intensity={0.3} />
      
      {/* Main directional light */}
      <directionalLight
        ref={directionalRef}
        position={[10, 10, 5]}
        intensity={1.2}
        color="#fbbf24"
        castShadow
      />
      
      {/* Rim lighting from behind */}
      <directionalLight
        ref={rimLightRef}
        position={[-5, 5, -10]}
        intensity={0.6}
        color="#f59e0b"
      />
      
      {/* Side lighting for depth */}
      <pointLight
        position={[8, 2, 8]}
        intensity={0.5}
        color="#e6a700"
        distance={20}
      />
    </>
  )
}

// Error boundary component for the 3D scene
function DragonScene({ 
  enableEyeTracking, 
  lightningActive 
}: { 
  enableEyeTracking: boolean
  lightningActive: boolean 
}) {
  return (
    <Suspense fallback={null}>
      <DragonLighting lightningActive={lightningActive} />
      <DragonHeadMesh 
        enableEyeTracking={enableEyeTracking}
        lightningActive={lightningActive}
      />
      {/* Fog for atmosphere */}
      <fog attach="fog" args={['#1a202c', 5, 25]} />
    </Suspense>
  )
}

// Main component
export function DragonHead3D({ 
  className = "",
  intensity = 0.8,
  enableEyeTracking = true,
  lightningActive = false,
  onLoad,
  onError,
  onFallback
}: DragonHead3DProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  // WebGL recovery hook
  const {
    initializeRecovery,
    diagnostics,
    shouldFallback,
    resetDiagnostics
  } = useWebGLRecovery({
    maxRecoveryAttempts: 3,
    recoveryDelayMs: 1000,
    fallbackEnabled: true,
    onContextLost: () => {
      console.warn('🔴 WebGL context lost in DragonHead3D')
    },
    onContextRestored: () => {
      console.log('🟢 WebGL context restored in DragonHead3D')
      // Reset any error states
      setHasError(false)
    },
    onRecoveryFailed: () => {
      console.error('❌ WebGL recovery failed in DragonHead3D')
      setHasError(true)
    },
    onFallback: () => {
      console.log('⚠️ WebGL fallback triggered in DragonHead3D')
      if (onFallback) {
        onFallback()
      }
    }
  })

  // Error handling
  const handleError = (error: Error) => {
    console.error('Dragon head loading error:', error)
    
    // Check if error is WebGL-related
    const isWebGLError = error.message.includes('WebGL') || 
                        error.message.includes('context') ||
                        error.message.includes('CONTEXT_LOST')
    
    if (isWebGLError) {
      console.warn('🔴 WebGL-related error detected in DragonHead3D, WebGL recovery will handle this')
      // Let WebGL recovery handle this error
      return
    }
    
    setHasError(true)
    
    // Propagate error to parent
    if (onError) {
      onError(error)
    }
  }

  // Loading state management
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true)
      if (onLoad) {
        onLoad()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Initialize WebGL recovery when Canvas is ready
  useEffect(() => {
    if (canvasRef.current && rendererRef.current) {
      initializeRecovery(canvasRef.current, rendererRef.current)
    }
  }, [canvasRef.current, rendererRef.current, initializeRecovery])

  if (hasError || shouldFallback) {
    return null // Fail silently to not break the page
  }

  return (
    <div className={`absolute inset-0 ${className}`}>
      <Canvas
        ref={canvasRef}
        camera={{ 
          position: [0, 1, 8], 
          fov: 45,
          near: 0.1,
          far: 100
        }}
        style={{ 
          background: 'transparent',
          pointerEvents: 'none' // Allow mouse events to pass through
        }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true, // Helps with context recovery
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={(state) => {
          // Canvas successfully created
          rendererRef.current = state.gl
          
          // Initialize WebGL recovery with the canvas and renderer
          if (canvasRef.current) {
            initializeRecovery(canvasRef.current, state.gl)
          }
        }}
        onError={(error) => {
          console.error('🎮 DragonHead3D Canvas error:', error)
          handleError(new Error('Canvas creation failed'))
        }}
      >
        {isLoaded && (
          <DragonScene 
            enableEyeTracking={enableEyeTracking}
            lightningActive={lightningActive}
          />
        )}
      </Canvas>
    </div>
  )
}

export default DragonHead3D