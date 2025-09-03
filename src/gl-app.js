import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import particlesVertex from "./shaders/particles/vertex.glsl";
import particlesFragment from "./shaders/particles/fragment.glsl";
import particlesGPUshader from "./shaders/gpu/particles.glsl";

export default class GLApp {
  constructor(id) {
    this.canvas = document.getElementById(id);

    // sizes
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      time: 0,
    };

    // BASE GEOMETRY
    this.baseGeometry = {};
    this.baseGeometry.instance = new THREE.SphereGeometry(3, 90, 90);
    this.baseGeometry.count = this.baseGeometry.instance.attributes.position.count;

    this.updatables = [];

    // PARTICLES
    this.particles = {};

    // SCENE
    this.scene = new THREE.Scene();
    this.camera = null;
    this.controls = null;

    // RENDERER
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // GPU
    this.gpu = {};

    // RESIZE
    window.addEventListener("resize", this.onResize.bind(this), false);
  }

  setPerspectiveCamera() {
    this.camera = new THREE.PerspectiveCamera(70, this.sizes.width / this.sizes.height, 0.001, 1000);
    this.camera.position.z = 8;
    window.camera = this.camera;

    return this;
  }

  setControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;
    this.controls.enablePan = false;

    return this;
  }

  addSphere() {
    // generamos los uv para mapear la textura en base a la resolucion de la GPU
    this.particlesUvArray = new Float32Array(this.baseGeometry.count * 2);

    // generamos una posicion base para poder ver algo
    const positions = new Float32Array(this.baseGeometry.count * 3);

    for (let y = 0; y < this.gpu.sizes; y++) {
      for (let x = 0; x < this.gpu.sizes; x++) {
        const i = y * this.gpu.sizes + x;
        const i2 = i * 2;

        const uvX = (x + 0.5) / this.gpu.sizes;
        const uvY = (y + 0.5) / this.gpu.sizes;

        this.particlesUvArray[i2] = uvX;
        this.particlesUvArray[i2 + 1] = uvY;
      }
    }

    // creamos la geometria vacia
    this.particles.geometry = new THREE.BufferGeometry();

    // Limita la cantidad de vértices que se van a renderizar (no crea posiciones nuevas)
    this.particles.geometry.setDrawRange(0, this.baseGeometry.count);

    // asignamos los atributos
    this.particles.geometry.setAttribute("aParticlesUv", new THREE.BufferAttribute(this.particlesUvArray, 2));
    this.particles.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // creamos el material
    this.particles.material = new THREE.ShaderMaterial({
      vertexShader: particlesVertex,
      fragmentShader: particlesFragment,
      wireframe: true,
      uniforms: {
        uSize: new THREE.Uniform(0.01),
        uResolution: new THREE.Uniform(new THREE.Vector2(this.sizes.width * this.sizes.pixelRatio, this.sizes.height * this.sizes.pixelRatio)),
        uParticlesTexture: new THREE.Uniform(this.baseParticlesTexture),
      },
    });

    // creamos el mesh
    this.particles.points = new THREE.Points(this.particles.geometry, this.particles.material);

    this.scene.add(this.particles.points);

    return this;
  }

  setGPGPU() {
    this.gpu.sizes = Math.ceil(Math.sqrt(this.baseGeometry.count));

    // creamos el renderer de la GPU
    this.gpu.computationRenderer = new GPUComputationRenderer(this.gpu.sizes, this.gpu.sizes, this.renderer);

    // creamos la textura base para la GPU SEra usada tambien para reinicar las posciones 
    this.baseParticlesTexture = this.gpu.computationRenderer.createTexture();

    // aqui llenamos la textura con los valores de la geometria. se ecnuentran dentro de la textura - image.data
    // llenamos un indice de 4 con uno de 3
    for (let i = 0; i < this.baseGeometry.count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;

      this.baseParticlesTexture.image.data[i4] = this.baseGeometry.instance.attributes.position.array[i3];
      this.baseParticlesTexture.image.data[i4 + 1] = this.baseGeometry.instance.attributes.position.array[i3 + 1];
      this.baseParticlesTexture.image.data[i4 + 2] = this.baseGeometry.instance.attributes.position.array[i3 + 2];
      
      // lo hacemos ramdom para poder usarlo en la vida de la particula 
      this.baseParticlesTexture.image.data[i4 + 3] = Math.random();
    }

    // la textura se inyecta en el shader bajoel nombre "uParticles"
    this.gpu.particlesVariable = this.gpu.computationRenderer.addVariable("uParticles", particlesGPUshader, this.baseParticlesTexture);

    // Uniforms
    this.gpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0);
    this.gpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0);
    this.gpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(this.baseParticlesTexture);


    // Esto define qué otras variables necesita este shader como input, En este caso, "uParticles" depende de sí misma,
    // para calcular el nuevo estado de las partículas, necesito el estado anterior de esas mismas partículas
    this.gpu.computationRenderer.setVariableDependencies(this.gpu.particlesVariable, [this.gpu.particlesVariable]);

    this.gpu.computationRenderer.init();

    // GPU debug panel
    this.gpu.debug = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({
        map: this.gpu.computationRenderer.getCurrentRenderTarget(this.gpu.particlesVariable).texture,
      })
    );
    this.gpu.debug.position.set(4, 0, 0);
    this.scene.add(this.gpu.debug);

    return this;
  }

  setOrthographicCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 0.4;

    this.camera = new THREE.OrthographicCamera((-frustumSize * aspect) / 2, (frustumSize * aspect) / 2, frustumSize / 2, -frustumSize / 2, 0.1, 1000);

    this.camera.position.set(0, 0, 4);
    this.camera.lookAt(0, 0, 0);

    return this;
  }

  setLights() {
    this.ambient = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.ambient);

    this.directional = new THREE.DirectionalLight(0xffffff, 20);
    this.directional.position.set(1.4, -0.09, 6.8);

    const helper = new THREE.DirectionalLightHelper(this.directional, 2, 0xff0000);
    // this.scene.add(helper);
    this.scene.add(this.directional);

    return this;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
  }

  addUpdatable(obj) {
    this.updatables.push(obj);
  }

  startWithRenderer() {
    const clock = new THREE.Clock();
    let previousTime = 0;

    const renderLoop = () => {
      const elapsedTime = clock.getElapsedTime();
      const deltaTime = elapsedTime - previousTime;
      previousTime = elapsedTime;

      this.gpu.particlesVariable.material.uniforms.uTime.value += elapsedTime;
      this.updatables.forEach((obj) => obj.update && obj.update(this.sizes));
      this.renderer.render(this.scene, this.camera);

      this.gpu.particlesVariable.material.uniforms.uTime.value = elapsedTime;
      this.gpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime;

      // Update GPU
      this.gpu.computationRenderer.compute();

      // este es el punto indicado para actulilzar ya que de este modo siempre tenemos el ultimo FBO del pingpong
      this.particles.material.uniforms.uParticlesTexture.value = this.gpu.computationRenderer.getCurrentRenderTarget(this.gpu.particlesVariable).texture;

      this.controls && this.controls.update();

      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }
}
