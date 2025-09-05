// =======================================
//  GPGPU Shader - Simulación de partículas
// =======================================
// Cada fragmento corresponde a 1 partícula (almacenada en textura)
//
//  - Se inicializa en la textura base (uBase)
//  - Se actualiza en cada frame con ruido simplex (flow field),
//    deformaciones orgánicas, atracción/repulsión con el mouse, etc.
//
// =======================================

#include ../includes/simplexNoise4d.glsl

// Uniforms
uniform float uTime;        // tiempo global
uniform float uDeltaTime;   // deltaTime entre frames
uniform sampler2D uBase;    // textura base con posiciones originales
uniform vec3 uMouse;        // posición del mouse en 3D
uniform vec3 uPrevMouse;    // posición previa del mouse

// ===========================================================
// Función auxiliar: distancia a un segmento (cápsula de radio r)
// ===========================================================
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

void main() { 
    float time = uTime;
    vec2 mouse = uMouse.xy;
    vec2 prevMouse = uPrevMouse.xy;

    // =======================================
    // UV de la partícula (coordenada del pixel)
    // =======================================
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Estado actual de la partícula
    vec4 particle = texture2D(uParticles, uv);

    // Posición original (sirve para resetear)
    vec4 base = texture2D(uBase, uv);

    // =======================================
    // Re-spawn: si alpha >= 1, se reinicia
    // =======================================
    if (particle.a >= 1.0) {
        particle.a = mod(particle.a, 1.0);   // reinicia vida
        particle.xyz = base.xyz;             // vuelve a la posición inicial
    }
    else {
        // =======================================
        // Fuerza de ruido (field strength)
        // =======================================
        float strength = simplexNoise4d(vec4(base.xyz, time + 1.0));
        strength = smoothstep(-1.0, 1.0, strength);

        float rand = base.w; // semilla aleatoria de cada partícula

        // =======================================
        // Flow field - movimiento pseudo-orgánico
        // =======================================
        vec3 pos = particle.xyz;
        pos += vec3(
            simplexNoise4d(vec4(particle.yzx, time)) * 0.1,
            simplexNoise4d(vec4(particle.zxy, time)) * 0.1,
            0.0
        );

        vec3 flowField = vec3(
            simplexNoise4d(vec4(pos.xyz + rand, time)),
            simplexNoise4d(vec4(pos.yzx + rand, time)),
            simplexNoise4d(vec4(pos.zxy + rand, time))
        );
        flowField = normalize(flowField);

        // =======================================
        // Falloff radial (fuerza menor en los bordes)
        // =======================================
        float radius = length(particle.xy);
        float falloff = smoothstep(4.5, 0.0, radius); // 1 en centro, 0 en borde

        // =======================================
        // Deformaciones orgánicas
        // =======================================
        float edge = 0.1 + smoothstep(0.5, 1.0, radius); // 0 en centro, 1 en borde
        float angle = atan(particle.y, particle.x);

        // Ruido extra para romper simetría
        float n = simplexNoise4d(vec4(particle.xy * 2.0, time, rand));

        // Onda que gira alrededor del centro
        float wave = sin(angle * 5.0 + time * -3.5 + rand * 1.0) * 0.003;

        // Solo en bordes
        particle.xy += normalize(particle.xy) * wave * edge;

        // Aplica el flowfield con atenuación radial
        particle.xyz += flowField * 0.025 * falloff;

        // =======================================
        // Interacción con el mouse
        // =======================================
        float dist = length(particle.xy - uMouse.xy);
        vec2 dir = normalize(particle.xy - uMouse.xy);
        float force = smoothstep(3.5, 0.0, dist); // 1 cerca del mouse
        particle.xy += dir * force * 0.04;

        // =======================================
        // Decay - envejecimiento de la partícula
        // =======================================
        particle.a += 0.02;
    }

    // Guardar el nuevo estado en la textura
    gl_FragColor = particle;
}
