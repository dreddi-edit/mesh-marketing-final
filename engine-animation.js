document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('engineCanvas');
  const wrap = document.getElementById('engine3dWrap');
  if (!canvas || !wrap || typeof THREE === 'undefined' || typeof gsap === 'undefined') return;

  // --- THREE.JS SETUP ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0710, 0.002); // Deep dark background fog

  const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 1000);
  camera.position.z = 15;
  camera.position.y = 2;
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // --- LIGHTING ---
  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x00d4e8, 2); // Cyan accent
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
  
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(-5, -5, 5);
  scene.add(pointLight);

  // --- GEOMETRY: PARTICLES TO CAPSULE ---
  const particleCount = 1000;
  
  // Create arrays for start (raw files) and end (capsule) positions
  const startPositions = new Float32Array(particleCount * 3);
  const endPositions = new Float32Array(particleCount * 3);
  const currentPositions = new Float32Array(particleCount * 3);
  
  // For the end shape, let's use an Icosahedron (the capsule core)
  const icosahedronGeometry = new THREE.IcosahedronGeometry(3, 2);
  const icosaVertices = icosahedronGeometry.attributes.position.array;
  
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // Start: Chaotic cloud spread out wide
    startPositions[i3] = (Math.random() - 0.5) * 40;
    startPositions[i3 + 1] = (Math.random() - 0.5) * 40;
    startPositions[i3 + 2] = (Math.random() - 0.5) * 40;
    
    // End: Mapped to the vertices of the icosahedron to form a dense shell
    // If we have more particles than vertices, loop through vertices
    const vertexIndex = (i * 3) % icosaVertices.length;
    endPositions[i3] = icosaVertices[vertexIndex];
    endPositions[i3 + 1] = icosaVertices[vertexIndex + 1];
    endPositions[i3 + 2] = icosaVertices[vertexIndex + 2];
    
    // Initialize current at start
    currentPositions[i3] = startPositions[i3];
    currentPositions[i3 + 1] = startPositions[i3 + 1];
    currentPositions[i3 + 2] = startPositions[i3 + 2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));

  // Custom particle material
  const material = new THREE.PointsMaterial({
    size: 0.15,
    color: 0x00d4e8,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
  
  // Add an inner glowing core that scales up at the end
  const coreGeometry = new THREE.IcosahedronGeometry(2.8, 1);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0710,
    emissive: 0x00d4e8,
    emissiveIntensity: 0.2,
    roughness: 0.1,
    metalness: 0.8,
    wireframe: true,
    transparent: true,
    opacity: 0
  });
  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  scene.add(coreMesh);

  // --- ANIMATION STATE ---
  const animState = {
    progress: 0,
    rotationSpeed: 0.002
  };

  // --- GSAP SCROLLTRIGGER ---
  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: wrap,
      pin: true,
      start: "center center",
      end: "+=800",
      scrub: 1.5,
    }
  });

  // Step 1: Particles exist, fade in first text
  tl.to('#step1', { opacity: 1, y: 0, duration: 1 })
    .to('#step1', { opacity: 0, y: -20, duration: 1, delay: 1 });

  // Step 2: Particles compress to structure
  tl.to(animState, { progress: 1, duration: 3 }, "-=1") // This drives the morph
    .to('#step2', { opacity: 1, y: 0, duration: 1 }, "-=2")
    .to('#step2', { opacity: 0, y: -20, duration: 1, delay: 1 });
    
  // Step 3: Core ignites, capsule solidifies
  tl.to(coreMaterial, { opacity: 0.5, emissiveIntensity: 0.8, duration: 2 }, "-=1")
    .to(material, { size: 0.05, opacity: 0.4, duration: 2 }, "-=2")
    .to(animState, { rotationSpeed: 0.01, duration: 2 }, "-=2")
    .to('#step3', { opacity: 1, y: 0, duration: 1 }, "-=1");

  // --- RENDER LOOP ---
  const clock = new THREE.Clock();
  
  function render() {
    requestAnimationFrame(render);
    
    // Rotate entire system smoothly
    particleSystem.rotation.y += animState.rotationSpeed;
    particleSystem.rotation.x += animState.rotationSpeed * 0.5;
    
    coreMesh.rotation.y += animState.rotationSpeed * 1.2;
    coreMesh.rotation.x += animState.rotationSpeed * 0.6;
    
    // Morph positions based on GSAP progress
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < particleCount * 3; i++) {
      // Ease out cubic interpolation for smoother snapping
      const p = animState.progress;
      const easeP = 1 - Math.pow(1 - p, 3);
      positions[i] = startPositions[i] + (endPositions[i] - startPositions[i]) * easeP;
    }
    geometry.attributes.position.needsUpdate = true;
    
    // Slight floaty hover effect on the whole scene
    const t = clock.getElapsedTime();
    scene.position.y = Math.sin(t * 0.5) * 0.5;

    renderer.render(scene, camera);
  }
  
  render();

  // --- RESIZE HANDLER ---
  window.addEventListener('resize', () => {
    if (!wrap) return;
    camera.aspect = wrap.clientWidth / wrap.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  });
});
