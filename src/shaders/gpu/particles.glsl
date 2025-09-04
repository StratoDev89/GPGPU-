#include ../includes/simplexNoise4d.glsl

uniform float uTime;
uniform float uDeltaTime;
uniform sampler2D uBase;
uniform vec3 uMouse; 
uniform vec3 uPrevMouse; 


// distancia a un segmento (cápsula de radio r)
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa,ba) / dot(ba,ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}


void main() { 
    float time = uTime ;
    vec2 mouse = uMouse.xy;
    vec2 prevMouse = uPrevMouse.xy;

    // usamos el fragCord que es el pixel actual entre la resolucion 
    // que es proporcionada por el gpgpu renderer 
    // y calculamos los UV para poder mapear la textura
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 particle = texture2D(uParticles, uv);
    vec4 base = texture2D(uBase, uv);


    // DEAD 
    if (particle.a >= 1.0) {
        particle.a = mod(particle.a, 1.0);
        particle.xyz = base.xyz;
    }

    // ALIVE 
    else {
    // STRENGTH 
    float strength = simplexNoise4d(vec4(base.xyz, time + 1.0));
    strength = smoothstep(-1.0, 1.0, strength);

    float rand = base.w; // cada partícula tiene su "semilla"

    // --- FLOW FIELD ---
    // perturba la posición para romper patrones lineales
    vec3 pos = particle.xyz * 1.0;
    pos += vec3(
        simplexNoise4d(vec4(particle.yzx, time )) * 0.1,
        simplexNoise4d(vec4(particle.zxy, time )) * 0.1,
        0.0
    );

    vec3 flowField = vec3(
        simplexNoise4d(vec4(pos.xyz + rand, time)),
        simplexNoise4d(vec4(pos.yzx + rand, time)),
        simplexNoise4d(vec4(pos.zxy + rand, time))
    );

    flowField = normalize(flowField);

    // --- FALLOFF RADIAL ---
    float radius = length(particle.xy);          // distancia al centro
    float falloff = smoothstep(4.5, 0.0, radius); // 1 en centro, 0 en borde

    // --- DEFORMACIÓN "ORGÁNICA" ---
    float edge =  0.1 + smoothstep(0.5, 1.0, radius);         // 0 en centro, 1 en bordes

    // dirección angular de la partícula
    float angle = atan(particle.y, particle.x);

    // --- DEFORMACIÓN "ORGÁNICA GIRATORIA" ---
    // ruido para romper simetría
    float n = simplexNoise4d(vec4(particle.xy * 2.0, time, rand));  

    // onda que se mueve en ángulo (va girando)
    float wave =  sin(angle * 5.0 + time * -3.5 + rand * 1.0) * 0.003;

    // aplicar solo en bordes
    particle.xy += normalize(particle.xy) * wave * edge;

    // aplica el flowfield con atenuación radial
    particle.xyz += flowField * 0.025 * falloff;


    float dist = length(particle.xy - uMouse.xy);
    vec2 dir = normalize(particle.xy - uMouse.xy);
    float force = smoothstep(3.5, 0.0, dist);
    particle.xy += dir * force * 0.04 ;

    // --- DECAY ---
    particle.a += 0.03;
    }

    gl_FragColor = particle;
}
