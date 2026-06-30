'use client';

import { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';

export default function Deer({ modelPath, ...props }) {
  const ref = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, ref);

  useEffect(() => {
    if (!animations || animations.length === 0) return;
    const first = animations[0];
    const action = actions?.[first.name];
    if (action) {
      action.reset().play();
    }
  }, [actions, animations]);

  return <primitive ref={ref} object={scene} {...props} />;
}

// optional: preload
useGLTF.preload('/models/deer/scene.gltf');
