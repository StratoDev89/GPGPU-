// Fragment shader para renderizar partículas como círculos con color

// Color interpolado desde el vertex shader
varying vec3 vColor;

void main() {
    // Calcula la distancia del fragmento (pixel) al centro del punto
    // gl_PointCoord va de (0,0) en la esquina inferior izquierda 
    // a (1,1) en la esquina superior derecha del punto
    float distanceToCenter = length(gl_PointCoord - 0.5);

    // Si el fragmento está fuera del radio de 0.5 → descartar (queda un círculo)
    if (distanceToCenter > 0.5) {
        discard;
    }

    // Asigna el color del fragmento usando el valor interpolado del vertex shader
    gl_FragColor = vec4(vColor, 1.0);

    // Aplica corrección de color y mapeo de tonos (propio de Three.js)
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
