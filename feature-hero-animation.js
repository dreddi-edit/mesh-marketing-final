// Feature Hero 3D Animation: "The Hyper-Core / Armillary Sphere"
// Pure abstract, premium cinematic representation of "Four surfaces. One engine."

(function initFeatureHero3D() {
  const container = document.getElementById('feature3dWrap');
  const canvas = document.getElementById('featureHeroCanvas');
  
  if (!container || !canvas) return;

  // --- Scene Setup ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06080c, 0.0035);

  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 260; // Pulled back to prevent clipping of rings

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // --- Lighting (More Vibrant) ---
  const ambientLight = new THREE.AmbientLight(0x111122, 1.2);
  scene.add(ambientLight);

  const mainLight = new THREE.PointLight(0x00d4e8, 4, 250);
  mainLight.position.set(20, 40, 20);
  scene.add(mainLight);

  const fillLight = new THREE.PointLight(0xff00aa, 4, 250);
  fillLight.position.set(-40, -20, -20);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
  rimLight.position.set(0, 50, -50);
  scene.add(rimLight);

  // --- Groups ---
  const masterGroup = new THREE.Group();
  scene.add(masterGroup);
  
  const coreGroup = new THREE.Group();
  masterGroup.add(coreGroup);

  const ringsGroup = new THREE.Group();
  masterGroup.add(ringsGroup);

  // --- The Central Capsule (The Engine) ---
  const capsuleGeo = new THREE.SphereGeometry(12, 32, 32);
  const capsuleMat = new THREE.MeshPhysicalMaterial({
    color: 0x02050a,
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    emissive: 0x00d4e8,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.95
  });
  const capsule = new THREE.Mesh(capsuleGeo, capsuleMat);
  capsule.scale.y = 1.8; // Stretch to form a capsule
  coreGroup.add(capsule);

  // Internal glowing wireframe for tech detail
  const wireGeo = new THREE.SphereGeometry(11.8, 16, 16);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00d4e8,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending
  });
  const innerWire = new THREE.Mesh(wireGeo, wireMat);
  innerWire.scale.y = 1.8; // Stretch to match capsule
  coreGroup.add(innerWire);

  // --- The 4 Rings (The Surfaces) ---
  const rings = [];
  const ringAngles = [
    { x: Math.PI / 4, y: 0, z: 0, speed: 0.002, radius: 30, color: 0x00d4e8 }, // Cyan
    { x: -Math.PI / 4, y: Math.PI / 3, z: 0, speed: -0.0015, radius: 38, color: 0xff00aa }, // Magenta
    { x: Math.PI / 6, y: -Math.PI / 6, z: Math.PI / 4, speed: 0.0025, radius: 46, color: 0x8800ff }, // Purple
    { x: -Math.PI / 3, y: -Math.PI / 4, z: -Math.PI / 6, speed: -0.002, radius: 54, color: 0x00ff88 }  // Green
  ];

  const ringGeoBase = new THREE.TorusGeometry(1, 0.3, 16, 128); // Placeholder, built per radius

  const cometGeo = new THREE.SphereGeometry(1.2, 16, 16);

  ringAngles.forEach((data, i) => {
    const rGroup = new THREE.Group();
    
    // Colorful metallic track
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x050a12,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 1.0,
      emissive: data.color,
      emissiveIntensity: 0.2
    });

    const geo = new THREE.TorusGeometry(data.radius, 0.4, 16, 128);
    const ring = new THREE.Mesh(geo, ringMat);
    rGroup.add(ring);

    // The glowing "Data Comet" traveling along the ring
    const cometMat = new THREE.MeshBasicMaterial({
      color: data.color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    const cometPivot = new THREE.Group();
    const comet = new THREE.Mesh(cometGeo, cometMat);
    comet.position.set(data.radius, 0, 0);
    
    // Add point light to comet to illuminate the rings
    const cometLight = new THREE.PointLight(data.color, 2, 40);
    comet.add(cometLight);
    
    cometPivot.add(comet);
    rGroup.add(cometPivot);

    // Set initial rotations
    rGroup.rotation.x = data.x;
    rGroup.rotation.y = data.y;
    rGroup.rotation.z = data.z;

    ringsGroup.add(rGroup);
    rings.push({ group: rGroup, pivot: cometPivot, speed: data.speed, cometSpeed: data.speed * 8 });
  });

  // --- Background Particles (Ambient Data) ---
  const pCount = 1000;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for(let i=0; i<pCount; i++) {
    pPos[i*3] = (Math.random() - 0.5) * 300;
    pPos[i*3+1] = (Math.random() - 0.5) * 300;
    pPos[i*3+2] = (Math.random() - 0.5) * 300 - 50;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x00d4e8,
    size: 0.8,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(pGeo, pMat);
  masterGroup.add(particles);

  // --- Mouse Parallax ---
  const mouse = new THREE.Vector2();
  const targetMouse = new THREE.Vector2();
  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', (event) => {
    targetMouse.x = (event.clientX - windowHalfX) * 0.0015;
    targetMouse.y = (event.clientY - windowHalfY) * 0.0015;
  });

  window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });

  // --- Animation Loop ---
  function animate() {
    requestAnimationFrame(animate);

    // Slowly rotate core
    coreGroup.rotation.y += 0.002;
    coreGroup.rotation.x = Math.sin(Date.now() * 0.0005) * 0.1;

    // Rotate rings and their comets
    rings.forEach(r => {
      r.group.rotation.x += r.speed * 0.2;
      r.group.rotation.y += r.speed * 0.3;
      r.pivot.rotation.z += r.cometSpeed;
    });

    // Slow ambient rotation of the entire assembly
    masterGroup.rotation.y += 0.0005;
    masterGroup.rotation.x += 0.0002;

    // Ambient particles drift
    particles.rotation.y -= 0.0003;

    // Parallax
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;
    
    // Tilt the whole group slightly based on mouse
    masterGroup.rotation.x = mouse.y * 0.5;
    masterGroup.rotation.y = mouse.x * 0.5;

    renderer.render(scene, camera);
  }

  animate();

  // --- GSAP ScrollTrigger Integration ---
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    
    // On scroll, expand the rings and tilt the assembly
    gsap.to(ringsGroup.scale, {
      x: 1.3,
      y: 1.3,
      z: 1.3,
      scrollTrigger: {
        trigger: ".feature-hero",
        start: "top top",
        end: "bottom top",
        scrub: 1
      }
    });

    gsap.to(coreGroup.scale, {
      x: 0.8,
      y: 0.8,
      z: 0.8,
      scrollTrigger: {
        trigger: ".feature-hero",
        start: "top top",
        end: "bottom top",
        scrub: 1
      }
    });
  }

})();
