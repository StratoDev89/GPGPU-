import GLApp from "./gl-app";
import GLGPGPU from "./gl-gpgpu";

const gl_app = new GLApp("canvas").setPerspectiveCamera().setControls();
const gpgpu = new GLGPGPU(gl_app).setColorSphere().setGPGPU().addSphere();


gl_app.addUpdatable(gpgpu);
gl_app.startWithRenderer();

