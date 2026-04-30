// Benchmark 3D Data Landscape
// Replaces the old 2D network canvas with a cinematic WebGL point cloud matrix.

(function initBenchmark3D() {
  const canvas = document.getElementById('mesh-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06080c, 0.0018);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.set(0, 150, 400);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // --- Data Matrix (Point Cloud) ---
  const countX = 100;
  const countZ = 100;
  const spacing = 15;
  const particleCount = countX * countZ;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const colorCyan = new THREE.Color(0x00d4e8);
  const colorMagenta = new THREE.Color(0xff00aa);
  const colorDark = new THREE.Color(0x002233);

  let idx = 0;
  for (let ix = 0; ix < countX; ix++) {
    for (let iz = 0; iz < countZ; iz++) {
      const x = (ix - countX / 2) * spacing;
      const z = (iz - countZ / 2) * spacing;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = z;

      // Mix colors based on position
      const mixRatio = (ix / countX) * 0.7 + (iz / countZ) * 0.3;
      const c = colorCyan.clone().lerp(colorMagenta, mixRatio);
      
      // Randomly dim some particles to create depth
      if (Math.random() > 0.8) {
        c.lerp(colorDark, 0.8);
      }

      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;

      idx++;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Load a simple circular sprite for the particles to look like glowing orbs
  // Since we can't load external images reliably, we'll draw a circle on a canvas and use it as a texture
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 32;
  textureCanvas.height = 32;
  const ctx = textureCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const spriteTexture = new THREE.CanvasTexture(textureCanvas);

  const material = new THREE.PointsMaterial({
    size: 6,
    vertexColors: true,
    map: spriteTexture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.6
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // --- Mouse Parallax ---
  const mouse = new THREE.Vector2();
  const targetMouse = new THREE.Vector2();
  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', (event) => {
    targetMouse.x = (event.clientX - windowHalfX) * 0.0005;
    targetMouse.y = (event.clientY - windowHalfY) * 0.0005;
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let time = 0;

  // --- Animation Loop ---
  function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // Wave animation
    const positions = particles.geometry.attributes.position.array;
    let i = 0;
    for (let ix = 0; ix < countX; ix++) {
      for (let iz = 0; iz < countZ; iz++) {
        // Create complex intersecting waves
        const x = positions[i * 3];
        const z = positions[i * 3 + 2];
        
        positions[i * 3 + 1] = 
          (Math.sin((ix + time * 2) * 0.3) * 20) + 
          (Math.cos((iz + time) * 0.2) * 20) + 
          (Math.sin(Math.sqrt(x*x + z*z) * 0.02 - time * 3) * 30);
          
        i++;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    // Smooth camera mouse follow
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    camera.position.x += (mouse.x * 200 - camera.position.x) * 0.02;
    camera.position.y += (150 + mouse.y * -100 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    // Slowly rotate the entire grid
    particles.rotation.y = time * 0.05;

    renderer.render(scene, camera);
  }

  animate();
})();
