import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import particlesVertex from "./shaders/particles/vertex.glsl";
import particlesFragment from "./shaders/particles/fragment.glsl";
import particlesGPUshader from "./shaders/gpu/particles.glsl";

export default class GLGPGPU {
  constructor(app) {
    this.gl_app = app;

    // BASE GEOMETRY
    this.baseGeometry = {};
    this.baseGeometry.instance = new THREE.SphereGeometry(3, 120, 120);
    this.baseGeometry.count = this.baseGeometry.instance.attributes.position.count;

    // PARTICLES
    this.particles = {};

    // GPU
    this.gpu = {};

    this.mouseActive = false;
    this.setRaycaster();
  }

  setRaycaster() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    this.mousePos3D = new THREE.Vector3();

    // Suponiendo que tienes un plano o malla que cubre tus partículas
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10), // del tamaño de tu sim
      new THREE.MeshBasicMaterial({ visible: false }) // invisible
    );
    plane.position.set(0, 0, -2);
    this.gl_app.scene.add(plane);

    window.addEventListener("mousemove", (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.gl_app.camera);
      const intersects = raycaster.intersectObject(plane);

      if (intersects.length > 0) {
        this.mousePos3D.copy(intersects[0].point); // posición 3D
        this.mouseActive = true;
      }
    });
  }

  setColorSphere() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorCenter: { value: new THREE.Color(0xffcba4) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0; // mapear UV de [0,1] a [-1,1]
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorCenter;
        varying vec2 vUv;
        void main() {
          float dist = length(vUv); // distancia al centro
          if(dist > 1.0) discard;  // fuera del círculo
          float alpha = 1.0 - clamp(dist, 0.0, 1.0); // 1 en el centro, 0 en el borde
          gl_FragColor = vec4(colorCenter, alpha);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6, 1, 1), material);
    mesh.position.set(0, 0, -0.2);
    this.gl_app.scene.add(mesh);

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
        uSize: new THREE.Uniform(0.013),
        uResolution: new THREE.Uniform(new THREE.Vector2(this.gl_app.sizes.width * this.gl_app.sizes.pixelRatio, this.gl_app.sizes.height * this.gl_app.sizes.pixelRatio)),
        uParticlesTexture: new THREE.Uniform(this.baseParticlesTexture),
      },
    });

    // creamos el mesh
    this.particles.points = new THREE.Points(this.particles.geometry, this.particles.material);

    this.gl_app.scene.add(this.particles.points);

    return this;
  }

  setGPGPU() {
    this.gpu.sizes = Math.ceil(Math.sqrt(this.baseGeometry.count));

    // creamos el renderer de la GPU
    this.gpu.computationRenderer = new GPUComputationRenderer(this.gpu.sizes, this.gpu.sizes, this.gl_app.renderer);

    // creamos la textura base para la GPU SEra usada tambien para reinicar las posciones
    this.baseParticlesTexture = this.gpu.computationRenderer.createTexture();

    // aqui llenamos la textura con los valores de la geometria. se ecnuentran dentro de la textura - image.data
    // llenamos un indice de 4 con uno de 3
    for (let i = 0; i < this.baseGeometry.count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;

      this.baseParticlesTexture.image.data[i4] = this.baseGeometry.instance.attributes.position.array[i3];
      this.baseParticlesTexture.image.data[i4 + 1] = this.baseGeometry.instance.attributes.position.array[i3 + 1];
      this.baseParticlesTexture.image.data[i4 + 2] = this.baseGeometry.instance.attributes.position.array[i3 + 2] * 0;

      // lo hacemos ramdom para poder usarlo en la vida de la particula
      this.baseParticlesTexture.image.data[i4 + 3] = Math.random();
    }

    // la textura se inyecta en el shader bajo el nombre "uParticles"
    this.gpu.particlesVariable = this.gpu.computationRenderer.addVariable("uParticles", particlesGPUshader, this.baseParticlesTexture);

    // Uniforms
    this.gpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0);
    this.gpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0);
    this.gpu.particlesVariable.material.uniforms.uBase = new THREE.Uniform(this.baseParticlesTexture);
    this.gpu.particlesVariable.material.uniforms.uMouse = new THREE.Uniform(new THREE.Vector3(10.0, 10.0, 0.0));
    // this.gpu.particlesVariable.material.uniforms.uPrevMouse = new THREE.Uniform(new THREE.Vector3(0, 0, 0));

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
    // this.gl_app.scene.add(this.gpu.debug);

    return this;
  }

  update(elapsedTime, deltaTime) {
    this.gpu.particlesVariable.material.uniforms.uTime.value = elapsedTime;
    this.gpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime;

    if (this.mouseActive) {
      this.gpu.particlesVariable.material.uniforms.uMouse.value.copy(this.mousePos3D);
    }

    this.gpu.computationRenderer.compute();

    this.particles.material.uniforms.uParticlesTexture.value = this.gpu.computationRenderer.getCurrentRenderTarget(this.gpu.particlesVariable).texture;
  }
}
