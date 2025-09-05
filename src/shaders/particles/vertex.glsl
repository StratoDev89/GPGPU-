// Vertex shader para renderizar partículas con tamaño dinámico

// Resolución de la pantalla (ancho, alto)
uniform vec2 uResolution;

// Tamaño base de la partícula
uniform float uSize;

// Textura que contiene la información de las partículas (posición y vida)
uniform sampler2D uParticlesTexture;

// Coordenadas UV personalizadas que apuntan al pixel dentro de la textura de partículas
attribute vec2 aParticlesUv;

// Color que se pasa al fragment shader
varying vec3 vColor;

void main() {

    // ===============================
    // Recuperar datos de la partícula
    // ===============================
    // La textura guarda en .xyz la posición y en .a un valor extra (vida/tiempo aleatorio)
    vec4 particle = texture2D(uParticlesTexture, aParticlesUv);

    // ===============================
    // Calcular la posición final
    // ===============================
    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    // ===============================
    // Calcular el tamaño dinámico
    // ===============================
    // Crece en los primeros instantes (a partir de alpha=0)
    float sizeIn = smoothstep(0.0, 0.1, particle.a);

    // Se desvanece cuando alpha se acerca a 1
    float sizeOut = 1.0 - smoothstep(0.7, 1.0, particle.a);

    // El tamaño final es el mínimo entre la fase de crecimiento y la de desaparición
    float size = min(sizeIn, sizeOut);

    // Ajusta el tamaño en píxeles considerando resolución y distancia a la cámara
    gl_PointSize = size * uSize * uResolution.y;
    gl_PointSize *= (1.0 / -viewPosition.z); // perspectiva

    // ===============================
    // Pasar color al fragment shader
    // ===============================
    vColor = vec3(0.8); // gris claro (puedes animar o variar este color)
}
