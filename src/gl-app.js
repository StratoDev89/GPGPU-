import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
    this.baseGeometry.instance = new THREE.SphereGeometry(3, 120, 120);
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

      this.controls && this.controls.update();
      this.renderer.render(this.scene, this.camera);

      this.updatables.forEach((obj) => obj.update && obj.update(elapsedTime, deltaTime));

      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }
}
