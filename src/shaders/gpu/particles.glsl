#include ../includes/simplexNoise4d.glsl

uniform float uTime;
uniform float uDeltaTime;
uniform sampler2D uBase;

void main() { 
    float time = uTime ;

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

        // FLOW FIELD 
        vec3 flowField = vec3(
            simplexNoise4d(vec4(particle.xyz + 0.0, time ) ),
            simplexNoise4d(vec4(particle.xyz + 1.0, time )),
            simplexNoise4d(vec4(particle.xyz + 2.0, time ))
        ) ;

        // como es una direccion hay que normalizarla 
        flowField = normalize(flowField);
        particle.xyz += flowField * 0.01  ;

        // ATRACCIÓN HACIA BASE
        //  particle.xyz = mix(particle.xyz, base.xyz, 0.1);

        // Decay 
        // se agrega el delta time para normalizar la diferencia de FPS entre pantallas 
        particle.a +=  0.03;
    }

    gl_FragColor = particle;
}
